import argparse
import json
from pathlib import Path


def load_feedback(path):
    records = []
    seen = set()
    for line_number, line in enumerate(Path(path).read_text().splitlines(), 1):
        if not line.strip():
            continue
        record = json.loads(line)
        if not isinstance(record, dict) or not isinstance(record.get("text"), str) or not 1 <= len(record["text"].strip()) <= 2000 or type(record.get("sarcastic")) is not bool:
            raise ValueError(f"{path}:{line_number}: expected text (1-2000 characters) and boolean sarcastic")
        text = record["text"].strip()
        key = " ".join(text.casefold().split())
        if key in seen:
            raise ValueError(f"{path}:{line_number}: duplicate feedback")
        seen.add(key)
        records.append({"text": text, "label": int(record["sarcastic"])})
    if {record["label"] for record in records} != {0, 1}:
        raise ValueError(f"{path}: both sarcastic and non-sarcastic examples are required")
    return records, seen


def main():
    parser = argparse.ArgumentParser(description="Fine-tune DeBERTa on labeled English feedback. Use a separate, untouched JSONL test set for evaluate:sarcasm.")
    parser.add_argument("--train", required=True, help='JSONL: {"text":"...","sarcastic":false}')
    parser.add_argument("--validation", required=True)
    parser.add_argument("--output", required=True, help="New local output directory; nothing is published automatically")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--validate-only", action="store_true", help="Validate data without loading ML dependencies or downloading weights")
    args = parser.parse_args()
    train, train_keys = load_feedback(args.train)
    validation, validation_keys = load_feedback(args.validation)
    if train_keys & validation_keys:
        parser.error("Training and validation feedback overlap")
    if Path(args.output).exists():
        parser.error("Output directory must not already exist")
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("Epochs and batch size must be positive")
    print(json.dumps({"train_examples": len(train), "validation_examples": len(validation)}))
    if args.validate_only:
        return

    from datasets import Dataset
    from sklearn.metrics import precision_recall_fscore_support
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, DataCollatorWithPadding, Trainer, TrainingArguments, set_seed

    set_seed(42)
    base = "microsoft/deberta-v3-base"
    tokenizer = AutoTokenizer.from_pretrained(base)
    model = AutoModelForSequenceClassification.from_pretrained(
        base, num_labels=2,
        id2label={0: "non_sarcastic", 1: "sarcastic"},
        label2id={"non_sarcastic": 0, "sarcastic": 1},
    )

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=512)

    def metrics(prediction):
        predicted = prediction.predictions.argmax(axis=-1)
        precision, recall, f1_score, _ = precision_recall_fscore_support(prediction.label_ids, predicted, average="binary", zero_division=0)
        return {"precision": precision, "recall": recall, "f1": f1_score}

    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=args.output, num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size,
            learning_rate=2e-5, weight_decay=0.01,
            eval_strategy="epoch", save_strategy="epoch", save_total_limit=1,
            load_best_model_at_end=True, metric_for_best_model="f1",
            report_to="none", seed=42, data_seed=42,
        ),
        train_dataset=Dataset.from_list(train).map(tokenize, batched=True, remove_columns=["text"]),
        eval_dataset=Dataset.from_list(validation).map(tokenize, batched=True, remove_columns=["text"]),
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=metrics,
    )
    trainer.train()
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)
    print("Saved locally. Evaluate on held-out customer feedback before deployment; scores are not calibrated.")


if __name__ == "__main__":
    main()