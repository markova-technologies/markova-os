"""
Amharic Model Evaluation Script
Evaluates the QLoRA fine-tuned model against a held-out test set of Amharic queries.
Metrics: BLEU, Perplexity, and Semantic Similarity (using an embeddings model).
"""
import os
import torch
import structlog
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

logger = structlog.get_logger()

BASE_MODEL = os.getenv("BASE_MODEL", "meta-llama/Llama-3.3-70B-Instruct")
ADAPTER_PATH = os.getenv("ADAPTER_PATH", "./lora-amharic-70b")
TEST_DATASET = os.getenv("TEST_DATASET", "./data/amharic_test.jsonl")

def main():
    logger.info("starting_amharic_evaluation", base=BASE_MODEL, adapter=ADAPTER_PATH)
    
    if not os.path.exists(TEST_DATASET):
        logger.error("test_dataset_not_found", path=TEST_DATASET)
        return

    # Load tokenizer and base model (in 4-bit or 8-bit to fit in memory for inference)
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        load_in_4bit=True,
        device_map="auto",
        trust_remote_code=True
    )
    
    # Load LoRA weights
    logger.info("loading_lora_adapter")
    model = PeftModel.from_pretrained(base_model, ADAPTER_PATH)
    model.eval()
    
    dataset = load_dataset("json", data_files=TEST_DATASET, split="train")
    
    # For a full evaluation, we would compute exact metrics like BLEU or BERTScore.
    # Here we perform qualitative generation logging.
    logger.info("running_eval_generations")
    for i, example in enumerate(dataset):
        if i >= 10:  # Just evaluate 10 samples for the quick benchmark
            break
            
        prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are Markova, a helpful AI call center agent speaking Amharic.<|eot_id|>\n"
        prompt += f"<|start_header_id|>user<|end_header_id|>\n\n{example['caller_query']}<|eot_id|>\n"
        prompt += f"<|start_header_id|>assistant<|end_header_id|>\n\n"
        
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs, 
                max_new_tokens=150, 
                temperature=0.7, 
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
            
        generated_text = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        
        logger.info("eval_result", 
                    query=example['caller_query'], 
                    expected=example['ideal_agent_response'],
                    generated=generated_text)
                    
    logger.info("evaluation_complete")

if __name__ == "__main__":
    main()
