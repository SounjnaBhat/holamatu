import os
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
import unicodedata
from collections import Counter
from transformers import AutoTokenizer, AutoModel, BertConfig
import onnxruntime
from torch.onnx import export as onnx_export

# -----------------------------------------------------------------------------
# 1. Vocabulary Pruning (Target: ~40k tokens from 197k)
# -----------------------------------------------------------------------------
def prune_vocabulary(corpus_paths, base_tokenizer_name="google/muril-base-cased", top_n=40000):
    print("Loading base tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_tokenizer_name)
    
    token_counts = Counter()
    
    print("Counting tokens across all corpora...")
    for path in corpus_paths:
        if not os.path.exists(path):
            continue
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    text = data.get('text', '')
                except:
                    text = line.strip()
                text = unicodedata.normalize('NFC', text)
                tokens = tokenizer.tokenize(text)
                token_counts.update(tokens)
                
    # Mandatory keep tokens: special tokens, single Kannada chars, digits
    keep_tokens = set(tokenizer.all_special_tokens)
    for vocab_token, vocab_id in tokenizer.vocab.items():
        if (len(vocab_token) == 1 and ('\u0c80' <= vocab_token <= '\u0cff' or vocab_token.isdigit())) or "[unused" in vocab_token:
            keep_tokens.add(vocab_token)
            
    # Add most frequent
    for token, count in token_counts.most_common():
        if len(keep_tokens) >= top_n:
            break
        keep_tokens.add(token)
        
    print(f"Pruned vocabulary to {len(keep_tokens)} tokens.")
    return keep_tokens

# -----------------------------------------------------------------------------
# 2. Model Architecture (Joint Intent + BIO Slots)
# -----------------------------------------------------------------------------
class JointNLU(nn.Module):
    def __init__(self, encoder, n_intents, n_slot_tags):
        super().__init__()
        self.encoder = encoder                        # MuRIL, pruned vocab
        self.dropout = nn.Dropout(0.1)
        hidden_size = encoder.config.hidden_size
        self.intent_head = nn.Linear(hidden_size, n_intents)   # from [CLS]
        self.slot_head = nn.Linear(hidden_size, n_slot_tags)   # per token, BIO

    def forward(self, input_ids, attention_mask, output_hidden_states=False):
        out = self.encoder(input_ids=input_ids, attention_mask=attention_mask, output_hidden_states=output_hidden_states)
        intent_logits = self.intent_head(self.dropout(out.pooler_output))
        slot_logits = self.slot_head(self.dropout(out.last_hidden_state))
        if output_hidden_states:
            return intent_logits, slot_logits, out.hidden_states
        return intent_logits, slot_logits

# -----------------------------------------------------------------------------
# 3. Distillation (12L -> 6L -> 3L directly from 12L teacher)
# -----------------------------------------------------------------------------
def distill_model(teacher_model, layer_mapping=[4, 8, 12]):
    print(f"Distilling 12 layers down to {len(layer_mapping)} layers directly from 12L teacher...")
    config = teacher_model.encoder.config
    config.num_hidden_layers = len(layer_mapping)
    
    student_encoder = AutoModel.from_config(config)
    student = JointNLU(student_encoder, teacher_model.intent_head.out_features, teacher_model.slot_head.out_features)
    
    # Copy embeddings
    student.encoder.embeddings.load_state_dict(teacher_model.encoder.embeddings.state_dict())
    
    # Copy mapped layers
    for student_idx, teacher_idx in enumerate(layer_mapping):
        student.encoder.encoder.layer[student_idx].load_state_dict(
            teacher_model.encoder.encoder.layer[teacher_idx - 1].state_dict()
        )
        
    # Copy heads
    student.intent_head.load_state_dict(teacher_model.intent_head.state_dict())
    student.slot_head.load_state_dict(teacher_model.slot_head.state_dict())
    
    return student

def distillation_loss(student_intent, teacher_intent, student_hidden, teacher_hidden, hard_labels, layer_mapping, T=2.0):
    """
    Distillation loss including layer-mapped MSE on hidden states.
    loss = 0.5 * KL(student / T, teacher / T) * T^2 
         + 0.3 * CE(student, hard_labels) 
         + 0.2 * MSE(student_hidden[i], teacher_hidden[map(i)])
    """
    kl_loss = nn.KLDivLoss(reduction='batchmean')(
        F.log_softmax(student_intent / T, dim=-1),
        F.softmax(teacher_intent / T, dim=-1)
    ) * (T * T)
    
    ce_loss = F.cross_entropy(student_intent, hard_labels)
    
    mse_loss = 0.0
    for student_idx, teacher_idx in enumerate(layer_mapping):
        # Hidden states: 0 is embeddings, 1 is layer 1, etc.
        mse_loss += F.mse_loss(student_hidden[student_idx + 1], teacher_hidden[teacher_idx])
        
    return 0.5 * kl_loss + 0.3 * ce_loss + 0.2 * mse_loss

# -----------------------------------------------------------------------------
# 4. Quantization, Export & Calibration
# -----------------------------------------------------------------------------
def export_quantized_onnx(model, dummy_input_ids, dummy_mask, export_path):
    print("Exporting to ONNX (FP32)...")
    model.eval()
    fp32_path = str(export_path).replace(".int8.onnx", ".fp32.onnx")
    
    onnx_export(
        model, 
        (dummy_input_ids, dummy_mask),
        fp32_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['input_ids', 'attention_mask'],
        output_names=['intent_logits', 'slot_logits'],
        dynamic_axes={
            'input_ids': {0: 'batch_size', 1: 'seq_len'},
            'attention_mask': {0: 'batch_size', 1: 'seq_len'},
            'intent_logits': {0: 'batch_size'},
            'slot_logits': {0: 'batch_size', 1: 'seq_len'}
        }
    )
    
    print("Quantizing to INT8...")
    import onnxruntime.quantization as q
    q.quantize_dynamic(
        model_input=fp32_path,
        model_output=str(export_path),
        weight_type=q.QuantType.QInt8
    )
    print(f"Exported INT8 ONNX to {export_path}")

def export_calibration_artifacts(out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    print("Exporting OOD Calibration artifacts...")
    # Mock generation of knn_bank (mean-pooled Float32 blob)
    knn_bank = torch.randn((500, 384), dtype=torch.float32)
    with open(out_dir / 'knn_bank.bin', 'wb') as f:
        f.write(knn_bank.numpy().tobytes())
        
    # Mock generation of calibration scalars
    calibration = {
        "temperature": 1.7,
        "tau1": 0.82,
        "knn_floor": 0.55
    }
    with open(out_dir / 'calibration.json', 'w') as f:
        json.dump(calibration, f, indent=2)
        
    print(f"Exported knn_bank.bin and calibration.json to {out_dir}")

# -----------------------------------------------------------------------------
# Main Execution (Mock wrapper for Kaggle script)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print("This script is designed to run on a GPU instance (e.g. Kaggle).")
    print("It implements Vocabulary Pruning, Joint NLU architecture, Distillation, and ONNX Quantization.")
    print("Execute this file in your Kaggle environment after data collection.")
