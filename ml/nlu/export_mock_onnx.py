import os
import torch
import torch.nn as nn
from pathlib import Path
from torch.onnx import export as onnx_export

# -----------------------------------------------------------------------------
# Dummy JointNLU for testing shapes and export
# -----------------------------------------------------------------------------
class MockJointNLU(nn.Module):
    def __init__(self, vocab_size=40000, hidden_size=384, n_intents=11, n_slot_tags=7):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, hidden_size)
        self.intent_head = nn.Linear(hidden_size, n_intents)
        self.slot_head = nn.Linear(hidden_size, n_slot_tags)

    def forward(self, input_ids, attention_mask):
        # Mock encoding: just embed and mean pool
        embeds = self.embedding(input_ids) # [batch, seq, hidden]
        
        # apply attention mask (broadcast)
        mask = attention_mask.unsqueeze(-1).float()
        masked_embeds = embeds * mask
        
        # pooler_output mock (mean pooling)
        sum_embeds = torch.sum(masked_embeds, dim=1)
        lengths = torch.clamp(torch.sum(attention_mask, dim=1, keepdim=True), min=1e-9)
        pooler = sum_embeds / lengths
        
        intent_logits = self.intent_head(pooler)
        slot_logits = self.slot_head(embeds)
        
        return intent_logits, slot_logits

def export():
    model = MockJointNLU()
    model.eval()
    
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    OUT_DIR = BASE_DIR / 'packages' / 'app' / 'public' / 'models'
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    fp32_path = OUT_DIR / 'intent_model.fp32.onnx'
    int8_path = OUT_DIR / 'intent_model.int8.onnx'
    
    dummy_input_ids = torch.randint(0, 1000, (1, 64), dtype=torch.int64)
    dummy_mask = torch.ones((1, 64), dtype=torch.int64)
    
    onnx_export(
        model, 
        (dummy_input_ids, dummy_mask),
        str(fp32_path),
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
    
    try:
        import onnxruntime.quantization as q
        q.quantize_dynamic(
            model_input=str(fp32_path),
            model_output=str(int8_path),
            weight_type=q.QuantType.QInt8
        )
        print(f"Exported INT8 ONNX to {int8_path}")
    except ImportError:
        print("onnxruntime not installed. Using FP32 model as mock INT8 model.")
        import shutil
        shutil.copy(str(fp32_path), str(int8_path))

if __name__ == "__main__":
    export()
