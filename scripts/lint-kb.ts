import * as fs from 'fs';
import * as path from 'path';

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge', 'cards');

function lintKb() {
    const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.yaml'));
    let errors = 0;
    
    for (const file of files) {
        const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
        
        if (!content.includes('source:')) {
            console.error(`[LINT ERROR] ${file} is missing a source citation.`);
            errors++;
        }
        
        if (content.toLowerCase().includes('chemical') && !content.includes('CIB&RC')) {
            console.error(`[LINT ERROR] ${file} mentions chemicals but lacks CIB&RC source.`);
            errors++;
        }
    }
    
    if (errors > 0) {
        console.error(`KB Lint failed with ${errors} errors.`);
        process.exit(1);
    } else {
        console.log('KB Lint passed.');
    }
}

lintKb();
