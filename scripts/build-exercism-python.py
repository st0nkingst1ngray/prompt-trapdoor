#!/usr/bin/env python3
"""Build the Exercism Python curriculum JSON from an upstream checkout.

Deprecated exercises are omitted. Concept tests are rewritten so they run
under unittest without pytest. Each exemplar is executed before it is saved.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

sys.dont_write_bytecode = True

SKIP_DIRS = {'.meta', '.articles', '.approaches', '.docs'}


def revision(root: Path) -> str:
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ''


def strip_pytest(text: str) -> str:
    text = re.sub(r'(?m)^import pytest\s*\n', '', text)
    text = re.sub(r'(?m)^from pytest import .*\n', '', text)
    text = re.sub(r'(?m)^[ \t]*@pytest\.mark\.\w+\([^)]*\)\s*\n', '', text)
    if 'pytest' in text:
        raise RuntimeError('pytest import survived')
    return text


def read(path: Path) -> str:
    return path.read_text(encoding='utf8')


def hints_from(docs: Path) -> list[str]:
    fallback = [
        'Read the failure once. The test name is the behavior that is still missing.',
        'Match the function or class name the test imports. A wrong name looks like a crash.',
        'Return the value. Printing it does not satisfy the test.',
    ]
    hint_file = docs / 'hints.md'
    found: list[str] = []
    if hint_file.exists():
        chunks = re.split(r'(?m)^## ', read(hint_file))
        for chunk in chunks[1:]:
            body = chunk.split('\n', 1)[1].strip() if '\n' in chunk else ''
            body = re.sub(r'\[[^\]]+\]\[[^\]]+\]', '', body)
            body = re.sub(r'\[[^\]]+\]\([^)]+\)', '', body)
            body = re.sub(r'(?m)^\[[^\]]+\]:.*\n?', '', body).strip()
            if body:
                found.append(body)
    while len(found) < 3:
        found.append(fallback[len(found)])
    return [item[:1200] for item in found[:3]]


def is_support_py(name: str) -> bool:
    return name.endswith('_test.py') or name.endswith('_data.py') or name == 'test_utils.py'


def exercise_files(directory: Path) -> tuple[str, str, list[dict[str, str]]]:
    solutions: list[Path] = []
    support: list[dict[str, str]] = []
    for path in sorted(directory.rglob('*')):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(directory).parts
        if any(part in SKIP_DIRS or part.startswith('.') for part in rel_parts):
            continue
        rel = path.relative_to(directory).as_posix()
        if path.suffix != '.py':
            continue
        text = read(path)
        if path.name.endswith('_test.py'):
            support.append({'name': rel, 'text': strip_pytest(text)})
        elif is_support_py(path.name):
            support.append({'name': rel, 'text': text})
        else:
            solutions.append(path)
    if len(solutions) != 1:
        raise RuntimeError(f'expected one solution file, found {[p.name for p in solutions]}')
    solution = solutions[0]
    return solution.name, read(solution), support


def exemplar(directory: Path) -> str:
    for name in ('exemplar.py', 'example.py'):
        path = directory / '.meta' / name
        if path.exists():
            return read(path)
    raise RuntimeError('missing exemplar')


def verify(directory: Path, solution_name: str, answer: str, support: list[dict[str, str]]) -> None:
    work = Path(tempfile.mkdtemp(prefix='expy-'))
    try:
        (work / solution_name).write_text(answer, encoding='utf8')
        for item in support:
            dest = work / item['name']
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(item['text'], encoding='utf8')
        script = textwrap.dedent(f'''
            import sys, unittest
            sys.path.insert(0, {str(work)!r})
            loader = unittest.TestLoader()
            suite = unittest.TestSuite()
            for name in { [Path(item["name"]).stem for item in support if item["name"].endswith("_test.py")] !r}:
                suite.addTests(loader.loadTestsFromName(name))
            result = unittest.TextTestRunner(stream=sys.stderr, verbosity=0).run(suite)
            sys.exit(0 if result.wasSuccessful() else 1)
        ''')
        done = subprocess.run([sys.executable, '-c', script], cwd=work, capture_output=True, text=True, timeout=20)
        if done.returncode != 0:
            tail = (done.stderr or done.stdout)[-600:]
            raise RuntimeError(tail)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def guide_text() -> str:
    return textwrap.dedent('''
        # Exercism Python

        These missions are the open Exercism Python track. Each one asks you to write a function or a small module. Check runs the exercise tests in a local Python sandbox.

        The concept track comes first. Practice missions are grouped by the difficulty Exercism published.

        Deprecated exercises are not included. A few concept tests used pytest only as a task marker; those markers are removed so the same tests run on the Python standard library.

        When a test cannot import your function, the name does not match. When it imports and fails, the failure text has the inputs and the expected return value.
    ''').strip() + '\n'


def build(upstream: Path) -> dict:
    config = json.loads(read(upstream / 'config.json'))
    concept = [ex for ex in config['exercises']['concept'] if ex.get('status') != 'deprecated']
    practice = [ex for ex in config['exercises']['practice'] if ex.get('status') != 'deprecated']
    practice.sort(key=lambda ex: (ex.get('difficulty') or 1, config['exercises']['practice'].index(ex)))

    modules = [{
        'id': 1,
        'name': 'concept',
        'display': 'Concept track',
        'slug': 'concept',
        'blurb': 'The concept syllabus, in track order. One exercise, then the next.',
        'difficulty': 'concept',
        'levelIds': [],
    }]
    by_difficulty: dict[int, dict] = {}
    levels = []
    failures: list[str] = []

    def module_for(kind: str, difficulty: int) -> dict:
        if kind == 'concept':
            return modules[0]
        if difficulty not in by_difficulty:
            mod = {
                'id': len(modules) + 1,
                'name': f'practice-{difficulty}',
                'display': f'Practice · difficulty {difficulty}',
                'slug': f'practice-{difficulty}',
                'blurb': f'Practice exercises Exercism marks as difficulty {difficulty}.',
                'difficulty': str(difficulty),
                'levelIds': [],
            }
            modules.append(mod)
            by_difficulty[difficulty] = mod
        return by_difficulty[difficulty]

    def add(kind: str, exercise: dict) -> None:
        slug = exercise['slug']
        directory = upstream / 'exercises' / kind / slug
        try:
            solution_name, scaffold, support = exercise_files(directory)
            answer = exemplar(directory)
            verify(directory, solution_name, answer, support)
        except Exception as error:
            failures.append(f'{kind}/{slug}: {str(error).splitlines()[-1][:240]}')
            return
        docs = directory / '.docs'
        instructions = read(docs / 'instructions.md') if (docs / 'instructions.md').exists() else exercise['name']
        introduction = read(docs / 'introduction.md') if (docs / 'introduction.md').exists() else ''
        concepts = exercise.get('concepts') or exercise.get('practices') or [kind]
        difficulty = exercise.get('difficulty') or 1
        mod = module_for(kind, difficulty if kind == 'practice' else 0)
        level_id = len(levels) + 1
        levels.append({
            'id': level_id,
            'module': mod['id'],
            'title': exercise['name'],
            'difficulty': 'concept' if kind == 'concept' else f'difficulty {difficulty}',
            'xp': 80 if kind == 'concept' else 30 + int(difficulty) * 20,
            'objective': instructions.strip() + '\n',
            'concepts': [str(item) for item in concepts][:8] or [kind],
            'hints': hints_from(docs),
            'debrief': 'The tests passed. The names, arguments, and return values match this exercise.',
            'mistakes': 'If the failure says the name is missing, rename the function. If it shows inputs and an expected value, change the return value, not a print.',
            'guide': (introduction or instructions).strip() + '\n',
            'answer': answer,
            'scaffold': scaffold,
            'editPath': solution_name,
            'tests': [Path(item['name']).stem for item in support if item['name'].endswith('_test.py')],
            'support': support,
            'stdin': '',
            'expected': '',
            'guards': [],
        })
        mod['levelIds'].append(level_id)

    for exercise in concept:
        add('concept', exercise)
    for exercise in practice:
        add('practice', exercise)

    if failures:
        print(f'{len(failures)} exercises failed', file=sys.stderr)
        for item in failures:
            print(item, file=sys.stderr)
        raise SystemExit(1)

    # Renumber modules in case a difficulty was skipped. Ids already assigned in order.
    return {
        'source': {
            'title': 'Exercism Python',
            'author': 'Exercism',
            'license': 'MIT',
            'copyright': 'Copyright (c) 2021 Exercism',
            'url': 'https://github.com/exercism/python',
            'branch': 'main',
            'revision': revision(upstream),
        },
        'guide': guide_text(),
        'support': [],
        'modules': modules,
        'levels': levels,
    }


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: build-exercism-python.py <upstream> <curriculum.json>', file=sys.stderr)
        sys.exit(1)
    upstream = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    curriculum = build(upstream)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(curriculum, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(f"Wrote {len(curriculum['levels'])} levels, {len(curriculum['modules'])} modules ({out.stat().st_size} bytes)")


if __name__ == '__main__':
    main()
