#!/usr/bin/env python3
"""Export actual visible messages from one explicitly supplied Codex JSONL."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=Path('docs/ai-history.md'))
args = parser.parse_args()
snapshot = args.source.read_bytes()
messages = []
skipped = 0
for line in snapshot.splitlines():
    record = json.loads(line)
    payload = record.get('payload', {})
    if record.get('type') != 'response_item' or payload.get('type') != 'message':
        continue
    role = payload.get('role')
    if role == 'assistant':
        if payload.get('phase') not in ('commentary', 'final_answer'):
            continue
    elif role != 'user':
        continue
    parts = [part['text'] for part in payload.get('content', [])
             if part.get('type') in ('input_text', 'output_text') and isinstance(part.get('text'), str)]
    content = '\n'.join(parts)
    if not content:
        continue
    if role == 'user' and content.lstrip().startswith((
        '<environment_context>', '<external_codex_apps_open_page>', '<hook_prompt',
    )):
        skipped += 1
        continue
    messages.append((record.get('timestamp', 'timestamp unavailable'), role, content))
if not messages:
    raise SystemExit('No visible messages found; no transcript written.')
header = f'''# Реальная AI-переписка — частичный экспорт

Источник: `{args.source.name}`. Сообщения извлечены из фактических записей
response_item/message в исходном порядке. Текст не восстановлен и не пересказан.
Включены пользовательские сообщения и видимые commentary/final_answer ассистента.
Системные, developer, внутренние рассуждения и tool outputs исключены;
технические инъекции environment/open_page/hooks исключены ({skipped}).
Первоначальный запрос, переданный файлом, сохранён отдельно в `initial-request.txt`.

Граница снимка: последнее включённое сообщение — {messages[-1][0]}.
Экспорт частичный: текущий ответ/будущие сообщения после этой границы отсутствуют;
полнота исходного журнала относительно всей переписки не гарантируется.
SHA-256 снимка исходного JSONL: `{hashlib.sha256(snapshot).hexdigest()}`.

'''
blocks = [header]
for index, (timestamp, role, content) in enumerate(messages, 1):
    blocks.append(f'## {index}. {role} — {timestamp}\n\n{content}\n\n---\n\n')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(''.join(blocks), encoding='utf-8')
print(f'Exported {len(messages)} actual messages to {args.output}')
