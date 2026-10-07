#!/usr/bin/env python3
"""Build the pyi-thon curriculum from upstream src/data/levels.js.

The reference answer is the upstream hint when that hint already prints the
expected output. Construct checks from the upstream offline grader are stored
as guards so a hardcoded print cannot skip the concept.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import textwrap
from pathlib import Path

GUARDS: dict[int, list[dict[str, str]]] = {
    2: [
        {'pattern': r'name\s*=', 'message': 'Create a variable called name.'},
        {'pattern': r'print\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s*\)', 'message': 'Print the variable, not a hardcoded string.'},
    ],
    3: [{'pattern': r'str\s*\(|f"|f\'|\.format\s*\(', 'message': 'Use str(), an f-string, or format() to combine the text and the number.'}],
    4: [{'pattern': r'input\s*\(', 'message': 'Use input() to ask for the name.'}],
    5: [{'pattern': r'\bif\b[\s\S]*\belse\b', 'message': 'Use both if and else.'}],
    6: [{'pattern': r'\belif\b', 'message': 'Use elif for the extra conditions.'}],
    7: [{'pattern': r'\bfor\b[\s\S]*\brange\s*\(', 'message': 'Use a for loop with range().'}],
    8: [{'pattern': r'\bwhile\b', 'message': 'Use a while loop.'}],
    9: [{'pattern': r'\bwhile\b[\s\S]*\binput\s*\(', 'message': 'Use a while loop and input().'}],
    10: [{'pattern': r'\bfor\b|\bwhile\b', 'message': 'Use a loop to add the numbers up.'}],
    11: [{'pattern': r'/', 'message': 'Use / to divide.'}],
    12: [
        {'pattern': r'\bwhile\b', 'message': 'Use a while loop.'},
        {'pattern': r'\bbreak\b', 'message': 'Use break to stop when the input is done.'},
        {'pattern': r'\binput\s*\(', 'message': 'Use input() to read each value.'},
    ],
    13: [{'pattern': r'\bdef\b[\s\S]*\breturn\b', 'message': 'Define a function and return the value.'}],
    14: [{'pattern': r'\bdef\s+greet\s*\([\s\S]*\breturn\b', 'message': 'Define greet(...) and return the greeting.'}],
    15: [{'pattern': r'\[.*\]', 'message': 'Create a list with square brackets.'}],
    16: [{'pattern': r'\.append\s*\([\s\S]*\blen\s*\(|\blen\s*\([\s\S]*\.append\s*\(', 'message': 'Use .append() and len().'}],
    17: [{'pattern': r'\{.*\}|\bdict\s*\(', 'message': 'Create a dictionary with { } or dict().'}],
    18: [{'pattern': r'\.items\s*\(\)[\s\S]*\bfor\b|\bfor\b[\s\S]*\.items\s*\(\)', 'message': 'Loop with for and .items().'}],
    19: [{'pattern': r'\bwhile\b[\s\S]*\binput\s*\([\s\S]*\.append\s*\(', 'message': 'Use a while loop, input(), and .append().'}],
    20: [{'pattern': r'\bopen\s*\(', 'message': 'Use open() to write and read the file.'}],
    21: [{'pattern': r'\btry\b[\s\S]*\bexcept\b', 'message': 'Use try and except.'}],
    22: [{'pattern': r'\bclass\b[\s\S]*\b__init__\b[\s\S]*\bself\b', 'message': 'Write a class with __init__ and self.'}],
    23: [{'pattern': r'\bimport\s+json\b[\s\S]*json\.dumps[\s\S]*json\.loads', 'message': 'Import json, then use dumps and loads.'}],
    24: [{'pattern': r'\bimport\s+math\b[\s\S]*\bdef\b[\s\S]*math\.pi', 'message': 'Import math, define a function, and use math.pi.'}],
    25: [{'pattern': r'\bdef\b[\s\S]*\bsum\s*\([\s\S]*\blen\s*\(', 'message': 'Define a function that uses sum() and len().'}],
    26: [{'pattern': r'\[.+for .+ in .+\]', 'message': 'Use a list comprehension: [expr for x in iterable].'}],
    27: [{'pattern': r'\.split\s*\([\s\S]*\.join\s*\(|\.join\s*\([\s\S]*\.split\s*\(', 'message': 'Use .split() and .join().'}],
    28: [{'pattern': r'f"|f\'', 'message': 'Use an f-string.'}],
    29: [{'pattern': r'\blambda\b[\s\S]*\bmap\s*\(|\bmap\s*\([\s\S]*\blambda\b', 'message': 'Use lambda and map().'}],
    30: [{'pattern': r'\bfor\b[\s\S]*\bif\b', 'message': 'Use a for loop and an if to filter.'}],
}


def revision(root: Path) -> str:
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ''


def load_levels(upstream: Path) -> list[dict]:
    script = (
        'import { LEVELS } from ' + json.dumps(str(upstream / 'src' / 'data' / 'levels.js')) + ';\n'
        'process.stdout.write(JSON.stringify(LEVELS));\n'
    )
    done = subprocess.run(['node', '--input-type=module', '-e', script], check=True, capture_output=True, text=True)
    return json.loads(done.stdout)


def run_answer(code: str, stdin: str) -> str:
    program = textwrap.dedent('''
        import io, sys
        code = sys.stdin.read()
        raw = sys.argv[1]
        inputs = raw.split("\\n") if raw else []
        index = 0
        def input(prompt=""):
            global index
            if index < len(inputs):
                value = inputs[index]
                index += 1
                return value
            return ""
        buf = io.StringIO()
        sys.stdout = buf
        namespace = {"input": input, "__name__": "__main__"}
        exec(compile(code, "solution.py", "exec"), namespace)
        sys.stdout = sys.__stdout__
        print(buf.getvalue().rstrip("\\n"), end="")
    ''')
    done = subprocess.run(
        [sys.executable, '-c', program, stdin],
        input=code,
        capture_output=True,
        text=True,
        timeout=5,
    )
    if done.returncode != 0:
        raise RuntimeError(done.stderr[-400:])
    return done.stdout


def normalize(text: str) -> str:
    return '\n'.join(line.rstrip() for line in text.strip().splitlines()).strip()


def guide_text() -> str:
    return textwrap.dedent('''
        # pyi-thon

        Thirty levels, three phases. Each mission is one small Python program. Check runs your code in a local sandbox and compares the printed output.

        When a mission says it is reading input, the game feeds the sample input for you. You still call input().

        The reference answer stays hidden until you ask for it. Hints start with the idea, not the whole program.
    ''').strip() + '\n'


def phase_module(phase: int) -> dict:
    names = {
        1: ('Foundations', 'Print, variables, decisions, and loops.'),
        2: ('Building', 'Functions, collections, files, and classes.'),
        3: ('Pythonic', 'Comprehensions, f-strings, and a last filter.'),
    }
    display, blurb = names[phase]
    return {
        'id': phase,
        'name': display.lower(),
        'display': display,
        'slug': display.lower(),
        'blurb': blurb,
        'difficulty': f'phase {phase}',
        'levelIds': [],
    }


def hints_for(level: dict) -> list[str]:
    concept = level.get('concept') or ''
    task = level.get('task') or ''
    hint = level.get('hint') or ''
    first_line = hint.split('\n', 1)[0]
    return [
        concept or 'Read the task and print exactly the expected output.',
        task,
        'Shape of the program: ' + first_line,
    ]


ANSWERS = {
    1: 'print("Hello, World!")\n',
    2: 'name = "Alice"\nprint(name)\n',
    3: 'name = "Alice"\nage = 25\nprint(name + " is " + str(age))\n',
    4: 'name = input("What is your name? ")\nprint("Hello, " + name)\n',
    5: 'score = 85\nif score >= 70:\n    print("pass")\nelse:\n    print("fail")\n',
    6: 'grade = 82\nif grade >= 90:\n    print("A")\nelif grade >= 80:\n    print("B")\nelif grade >= 70:\n    print("C")\nelse:\n    print("F")\n',
    7: 'for i in range(5):\n    print(i)\n',
    8: 'count = 1\nwhile count <= 5:\n    print(count)\n    count = count + 1\n',
    9: 'count = 0\nwhile count < 3:\n    num = input()\n    print(num)\n    count = count + 1\n',
    10: 'total = 0\nfor i in range(1, 6):\n    total = total + i\nprint(total)\n',
    11: 'total = 10 + 20 + 30\naverage = total / 3\nprint(average)\n',
    12: 'total = 0\nwhile True:\n    val = input()\n    if val == "done":\n        break\n    total = total + int(val)\nprint(total)\n',
    13: 'def double(n):\n    return n * 2\nprint(double(7))\n',
    14: 'def greet(name, greeting):\n    return greeting + ", " + name\nprint(greet("Alice", "Hello"))\n',
    15: 'fruits = ["apple", "banana", "cherry"]\nprint(fruits[1])\n',
    16: 'nums = [1, 2, 3]\nnums.append(4)\nprint(len(nums))\n',
    17: 'person = {"name": "Alice", "age": 25}\nprint(person["name"])\n',
    18: 'scores = {"math": 90, "science": 85}\nfor subject, score in scores.items():\n    print(subject + ": " + str(score))\n',
    19: 'todos = []\nwhile True:\n    task = input()\n    if task == "done":\n        break\n    todos.append(task)\nfor task in todos:\n    print(task)\n',
    20: 'with open("output.txt", "w") as handle:\n    handle.write("Hello from Python")\nwith open("output.txt") as handle:\n    print(handle.read())\n',
    21: 'try:\n    int("hello")\nexcept ValueError:\n    print("Not a number")\n',
    22: 'class Dog:\n    def __init__(self, name):\n        self.name = name\n    def bark(self):\n        return self.name + " says woof!"\nprint(Dog("Rex").bark())\n',
    23: 'import json\ndata = {"app": "MyApp", "version": 2}\njson_str = json.dumps(data)\nparsed = json.loads(json_str)\nprint(parsed["app"])\n',
    24: 'import math\ndef circle_area(r):\n    return math.pi * r * r\nprint(round(circle_area(5), 2))\n',
    25: 'def get_average(scores_dict):\n    return sum(scores_dict.values()) / len(scores_dict)\nscores = {"python": 85, "git": 90}\nprint(round(get_average(scores), 1))\n',
    26: 'squares = [x * x for x in range(1, 6)]\nprint(squares)\n',
    27: 'text = "hello world python"\nprint("-".join(text.split(" ")))\n',
    28: 'language = "Python"\nversion = 3\nprint(f"{language} version {version} is awesome!")\n',
    29: 'result = list(map(lambda x: x * 3, [1, 2, 3, 4, 5]))\nprint(result)\n',
    30: 'students = [{"name": "Alice", "score": 92}, {"name": "Bob", "score": 78}, {"name": "Carol", "score": 88}]\nfor student in students:\n    if student["score"] >= 80:\n        print(student["name"])\n',
}


def build(upstream: Path) -> dict:
    modules = {1: phase_module(1), 2: phase_module(2), 3: phase_module(3)}
    levels = []
    for row in load_levels(upstream):
        stdin = row.get('simulatedInput') or ''
        answer = ANSWERS[int(row['id'])]
        for guard in GUARDS.get(int(row['id']), []):
            if re.search(guard['pattern'], answer) is None:
                raise RuntimeError(f"level {row['id']} answer misses guard {guard['pattern']}")
        actual = run_answer(answer, stdin)
        if normalize(actual) != normalize(row['expectedOutput']):
            raise RuntimeError(f"level {row['id']} hint output {actual!r} != {row['expectedOutput']!r}")
        phase = int(row['phase'])
        level_id = int(row['id'])
        xp = {1: 40, 2: 60, 3: 80}[phase]
        levels.append({
            'id': level_id,
            'module': phase,
            'title': row['title'],
            'difficulty': f'phase {phase}',
            'xp': xp,
            'objective': row['task'].strip() + '\n\n' + row['concept'].strip() + '\n',
            'concepts': list(row.get('tags') or []),
            'hints': hints_for(row),
            'debrief': row.get('explanation') or 'The output matches.',
            'mistakes': 'Match the text exactly, including spaces and capitalization. If the mission uses input(), call input() instead of hardcoding the sample.',
            'guide': row.get('subtitle') or row['concept'],
            'answer': answer if answer.endswith('\n') else answer + '\n',
            'scaffold': row.get('starterCode') or '',
            'editPath': 'solution.py',
            'tests': ['stdout'],
            'support': [],
            'stdin': stdin,
            'expected': row['expectedOutput'],
            'guards': GUARDS.get(level_id, []),
        })
        modules[phase]['levelIds'].append(level_id)
    return {
        'source': {
            'title': 'pyi-thon',
            'author': 'Edward Yi',
            'license': 'MIT',
            'copyright': 'Copyright (c) 2026 Edward Yi',
            'url': 'https://github.com/aiedwardyi/pyi-thon',
            'branch': 'main',
            'revision': revision(upstream),
        },
        'guide': guide_text(),
        'support': [],
        'modules': [modules[1], modules[2], modules[3]],
        'levels': levels,
    }


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: build-pyithon.py <upstream> <curriculum.json>', file=sys.stderr)
        sys.exit(1)
    curriculum = build(Path(sys.argv[1]).resolve())
    out = Path(sys.argv[2]).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(curriculum, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(f"Wrote {len(curriculum['levels'])} levels, {len(curriculum['modules'])} modules ({out.stat().st_size} bytes)")


if __name__ == '__main__':
    main()
