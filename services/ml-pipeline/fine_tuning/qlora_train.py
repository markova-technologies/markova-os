"""
Markova Amharic QLoRA Fine-Tuning Script
Base Model: meta-llama/Llama-3.3-70B-Instruct
Technique: QLoRA (4-bit quantized LoRA) for memory efficiency on A100s.
"""
import os
import torch
import structlog
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

logger = structlog.get_logger()

# Configuration
MODEL_ID = os.getenv("MODEL_ID", "meta-llama/Llama-3.3-70B-Instruct")
DATASET_PATH = os.getenv("DATASET_PATH", "./data/amharic_call_transcripts.jsonl")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./lora-amharic-70b")

def format_instruction(example):
    """
    Format Markova call transcripts into instruction pairs.
    Expected keys: 'caller_query', 'ideal_agent_response'
    """
    prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are Markova, a helpful AI call center agent speaking Amharic.<|eot_id|>\n"
    prompt += f"<|start_header_id|>user<|end_header_id|>\n\n{example['caller_query']}<|eot_id|>\n"
    prompt += f"<|start_header_id|>assistant<|end_header_id|>\n\n{example['ideal_agent_response']}<|eot_id|>"
    return {"text": prompt}

def main():
    logger.info("starting_amharic_qlora_tuning", model_id=MODEL_ID, dataset=DATASET_PATH)

    # 1. Load Dataset
    if not os.path.exists(DATASET_PATH):
        logger.error("dataset_not_found", path=DATASET_PATH)
        return
        
    dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
    dataset = dataset.map(format_instruction)
    
    # 2. 4-bit Quantization Config (BitsAndBytes)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    # 3. Load Model and Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )
    
    # 4. Prepare for k-bit training and apply LoRA
    model = prepare_model_for_kbit_training(model)
    
    peft_config = LoraConfig(
        r=64,
        lora_alpha=16,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj"
        ],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()
    
    # 5. Training Arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        logging_steps=10,
        max_steps=1000,
        save_strategy="steps",
        save_steps=200,
        optim="paged_adamw_32bit",
        bf16=True,  # Assuming A100s
        report_to="tensorboard"
    )
    
    # 6. SFTTrainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=peft_config,
        dataset_text_field="text",
        max_seq_length=2048,
        tokenizer=tokenizer,
        args=training_args,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False)
    )
    
    logger.info("beginning_training")
    trainer.train()
    
    # 7. Save Final Adapter
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    logger.info("training_complete", output_dir=OUTPUT_DIR)

if __name__ == "__main__":
    main()
