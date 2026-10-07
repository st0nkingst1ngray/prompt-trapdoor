#!/usr/bin/env python3
"""Build public/python-koans/curriculum.json from a python_koans checkout.

Each failing koan test becomes one mission. Fill-in tests are solved by
running them and replacing the blank the assertion is waiting on. Project
koans (triangle, greed, dice, proxy) ship a reference implementation.

Upstream engine files (sensei, mountain, colorama) are not copied.
"""
from __future__ import annotations

import ast
import importlib
import inspect
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import traceback
import unittest
from pathlib import Path

sys.dont_write_bytecode = True

BLANK_RE = re.compile(r'(?<![A-Za-z0-9_])_{2,5}(?![A-Za-z0-9_])')
FILL = '-=> FILL ME IN! <=-'
TF = '-=> TRUE OR FALSE? <=-'

SKIP_CLASSES = {'AboutExtraCredit', 'TelevisionTest'}

# One mission for the whole class. edit is the file the hunter changes.
PROJECTS = {
    'AboutTriangleProject': 'koans/triangle.py',
    'AboutTriangleProject2': 'koans/triangle.py',
    'AboutScoringProject': 'koans/about_scoring_project.py',
    'AboutDiceProject': 'koans/about_dice_project.py',
    'AboutProxyObjectProject': 'koans/about_proxy_object_project.py',
}


def revision(root: Path) -> str:
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ''


def safe_literal(value) -> str | None:
    if isinstance(value, (str, int, float, bool, type(None), bytes, complex)):
        return repr(value)
    if isinstance(value, type):
        return value.__name__
    if isinstance(value, tuple):
        parts = [safe_literal(item) for item in value]
        if any(part is None for part in parts):
            return None
        body = ', '.join(parts)
        if len(parts) == 1:
            body += ','
        return f'({body})'
    if isinstance(value, list):
        parts = [safe_literal(item) for item in value]
        if any(part is None for part in parts):
            return None
        return '[' + ', '.join(parts) + ']'
    if isinstance(value, dict):
        parts = []
        for key, item in value.items():
            key_lit = safe_literal(key)
            item_lit = safe_literal(item)
            if key_lit is None or item_lit is None:
                return None
            parts.append(f'{key_lit}: {item_lit}')
        return '{' + ', '.join(parts) + '}'
    if isinstance(value, (set, frozenset)):
        parts = [safe_literal(item) for item in value]
        if any(part is None for part in parts):
            return None
        if not parts:
            return 'set()' if isinstance(value, set) else 'frozenset()'
        body = '{' + ', '.join(parts) + '}'
        return body if isinstance(value, set) else f'frozenset({body})'
    return None


def py_literal(value) -> str:
    if isinstance(value, type):
        return value.__name__
    return repr(value)


class Blank(str):
    """Stand-in for __, ____, and _____. Comparing it reveals the other side.

    It is a str so `return __` from `__str__` is legal. Equality still refuses
    to succeed until the builder replaces the blank with a real value.
    """

    def __new__(cls, label: str):
        return str.__new__(cls, label)

    def __repr__(self) -> str:
        return str.__str__(self)

    def __eq__(self, other) -> bool:
        if isinstance(other, Blank):
            return False
        frame = inspect.currentframe()
        lineno = frame.f_back.f_lineno if frame and frame.f_back else None
        literal = safe_literal(other)
        if literal is None:
            literal = py_literal(other)
        raise FillSignal(lineno, literal, 'literal')

    def __hash__(self) -> int:
        return hash(str.__str__(self))

    def __bool__(self) -> bool:
        frame = inspect.currentframe()
        lineno = frame.f_back.f_lineno if frame and frame.f_back else None
        raise FillSignal(lineno, 'True', 'literal')


def is_blank_value(value) -> bool:
    if isinstance(value, Blank):
        return True
    if isinstance(value, str) and value in (FILL, TF):
        return True
    if isinstance(value, type) and value.__name__ == '___':
        return True
    return False


LAST_FILL: FillSignal | None = None


class FillSignal(Exception):
    def __init__(self, lineno: int | None, literal: str, mode: str):
        global LAST_FILL
        super().__init__(literal)
        self.lineno = lineno
        self.literal = literal
        self.mode = mode
        LAST_FILL = self


def install_hooks() -> None:
    import runner.koan as koan

    def caller_line() -> int:
        frame = inspect.currentframe()
        assert frame is not None and frame.f_back is not None and frame.f_back.f_back is not None
        return frame.f_back.f_back.f_lineno

    def assert_equal(self, first, second, msg=None):
        frame = inspect.currentframe()
        outer = frame.f_back if frame else None
        filename = outer.f_code.co_filename if outer else ''
        lineno = outer.f_lineno if outer else 0
        line = ''
        if filename and lineno:
            try:
                line = Path(filename).read_text(encoding='utf8').splitlines()[lineno - 1]
            except (OSError, IndexError):
                line = ''
        on_line = BLANK_RE.search(line) is not None
        if is_blank_value(first):
            source = assert_argument_source(filename, lineno, 1) if on_line else None
            raise FillSignal(lineno, safe_literal(second) or source or py_literal(second), 'literal')
        if is_blank_value(second):
            source = assert_argument_source(filename, lineno, 0) if on_line else None
            raise FillSignal(lineno, safe_literal(first) or source or py_literal(first), 'literal')
        return unittest.TestCase.assertEqual(self, first, second, msg)

    def assert_not_equal(self, first, second, msg=None):
        if is_blank_value(first) or is_blank_value(second):
            raise FillSignal(caller_line(), '', 'not-equal')
        return unittest.TestCase.assertNotEqual(self, first, second, msg)

    def assert_true(self, expr, msg=None):
        if is_blank_value(expr):
            raise FillSignal(caller_line(), 'True', 'literal')
        if expr is False:
            frame = inspect.currentframe()
            outer = frame.f_back if frame else None
            source = ''
            if outer is not None:
                try:
                    source = Path(outer.f_code.co_filename).read_text(encoding='utf8').splitlines()[outer.f_lineno - 1]
                except (OSError, IndexError):
                    source = ''
            if 'assertTrue(False' in source:
                raise FillSignal(caller_line(), 'True', 'flip-false')
        return unittest.TestCase.assertTrue(self, expr, msg)

    def assert_false(self, expr, msg=None):
        if is_blank_value(expr):
            raise FillSignal(caller_line(), 'False', 'literal')
        if expr is True:
            raise FillSignal(caller_line(), 'False', 'flip-true')
        return unittest.TestCase.assertFalse(self, expr, msg)

    def assert_raises(self, expected_exception, *args, **kwargs):
        if is_blank_value(expected_exception):
            line = caller_line()

            class _Ctx:
                def __enter__(self):
                    return None

                def __exit__(self, exc_type, exc, tb):
                    if exc_type is None:
                        raise AssertionError('expected an exception')
                    raise FillSignal(line, exc_type.__name__, 'literal')

            if args or kwargs:
                with _Ctx():
                    try:
                        args[0](*args[1:], **kwargs)
                    except Exception:
                        pass
                return None
            return _Ctx()
        return unittest.TestCase.assertRaises(self, expected_exception, *args, **kwargs)

    def assert_regex(self, text, regex, msg=None):
        if is_blank_value(regex):
            raise FillSignal(caller_line(), py_literal(re.escape(str(text))), 'literal')
        if is_blank_value(text):
            raise FillSignal(caller_line(), '', 'regex')
        return unittest.TestCase.assertRegex(self, text, regex, msg)

    def assert_almost(self, first, second, places=None, msg=None, delta=None):
        if is_blank_value(first):
            raise FillSignal(caller_line(), py_literal(second), 'literal')
        if is_blank_value(second):
            raise FillSignal(caller_line(), py_literal(first), 'literal')
        return unittest.TestCase.assertAlmostEqual(self, first, second, places, msg, delta)

    koan.__ = Blank(FILL)
    koan.____ = Blank(TF)
    koan._____ = Blank('0')
    koan.Koan.assertEqual = assert_equal
    koan.Koan.assertEquals = assert_equal
    koan.Koan.assertNotEqual = assert_not_equal
    koan.Koan.assertTrue = assert_true
    koan.Koan.assertFalse = assert_false
    koan.Koan.assertRaises = assert_raises
    koan.Koan.assertRegex = assert_regex
    koan.Koan.assertAlmostEqual = assert_almost


def drop_other_tests(src: str, class_name: str, keep_test: str) -> str:
    tree = ast.parse(src)
    ranges: list[tuple[int, int]] = []
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and item.name.startswith('test_') and item.name != keep_test:
                    ranges.append((item.lineno, item.end_lineno or item.lineno))
        elif isinstance(node, ast.ClassDef) and node.name != class_name and node.name.endswith('Test'):
            ranges.append((node.lineno, node.end_lineno or node.lineno))
    if not ranges:
        return src
    lines = src.splitlines(keepends=True)
    kept = []
    for index, line in enumerate(lines, start=1):
        if any(start <= index <= end for start, end in ranges):
            continue
        kept.append(line)
    return ''.join(kept)


def assert_argument_source(filename: str, lineno: int, index: int) -> str | None:
    try:
        lines = Path(filename).read_text(encoding='utf8').splitlines()
    except OSError:
        return None
    if lineno < 1 or lineno > len(lines):
        return None
    chunk = lines[lineno - 1]
    cursor = lineno
    while chunk.count('(') > chunk.count(')') and cursor < len(lines):
        cursor += 1
        chunk += '\n' + lines[cursor - 1]
    try:
        tree = ast.parse(chunk.strip())
    except SyntaxError:
        return None
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr.startswith('assert'):
            if index < len(node.args):
                return ast.get_source_segment(chunk.strip(), node.args[index])
    return None


def replace_on_line(src: str, lineno: int, literal: str, mode: str) -> str:
    lines = src.splitlines(keepends=True)
    line = lines[lineno - 1]
    if mode == 'flip-false':
        if 'assertTrue(False' in line:
            lines[lineno - 1] = line.replace('assertTrue(False', 'assertTrue(True', 1)
            return ''.join(lines)
        if re.search(r'\bassert\s+False\b', line):
            lines[lineno - 1] = re.sub(r'\bassert\s+False\b', 'assert True', line, count=1)
            return ''.join(lines)
    if mode == 'flip-true' and 'assertFalse(True' in line:
        lines[lineno - 1] = line.replace('assertFalse(True', 'assertFalse(False', 1)
        return ''.join(lines)
    match = BLANK_RE.search(line)
    if not match:
        raise LookupError(f'no blank on line {lineno}: {line.rstrip()}')
    lines[lineno - 1] = line[: match.start()] + literal + line[match.end() :]
    return ''.join(lines)


def replace_first_blank(src: str, literal: str) -> str:
    lines = src.splitlines(keepends=True)
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        match = BLANK_RE.search(line)
        if not match:
            continue
        lines[index] = line[: match.start()] + literal + line[match.end() :]
        return ''.join(lines)
    raise LookupError('no blank token in the focused file')


KOAN_ALIASES = '''
# Python 3.12 removed several unittest aliases the koans still call.
for _old, _new in (
    ("assertEquals", "assertEqual"),
    ("assertNotEquals", "assertNotEqual"),
    ("assertAlmostEquals", "assertAlmostEqual"),
    ("assertRegexpMatches", "assertRegex"),
):
    if not hasattr(Koan, _old):
        setattr(Koan, _old, getattr(Koan, _new))
'''


def koan_source(upstream: Path) -> str:
    text = (upstream / 'runner' / 'koan.py').read_text(encoding='utf8')
    if 'Python 3.12 removed' not in text:
        text = text.rstrip() + '\n' + KOAN_ALIASES
    return text


def prepare_workspace(upstream: Path, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    shutil.copytree(upstream / 'koans', dest / 'koans')
    (dest / 'runner').mkdir()
    shutil.copy(upstream / 'runner' / '__init__.py', dest / 'runner' / '__init__.py')
    (dest / 'runner' / 'koan.py').write_text(koan_source(upstream), encoding='utf8')
    shutil.copy(upstream / 'example_file.txt', dest / 'example_file.txt')
    shutil.copy(upstream / 'contemplate_koans.py', dest / 'contemplate_koans.py')


def unload(workspace: Path | None = None) -> None:
    for name in list(sys.modules):
        if name == 'koans' or name.startswith('koans.') or name == 'runner' or name.startswith('runner.') or name == 'contemplate_koans':
            del sys.modules[name]
    importlib.invalidate_caches()
    if workspace is not None:
        for cache in workspace.rglob('__pycache__'):
            shutil.rmtree(cache, ignore_errors=True)


def run_one(workspace: Path, qualname: str) -> None:
    global LAST_FILL
    LAST_FILL = None
    unload(workspace)
    while sys.path and sys.path[0] == str(workspace):
        sys.path.pop(0)
    sys.path.insert(0, str(workspace))
    os.chdir(workspace)
    install_hooks()
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromName(qualname)
    result = unittest.TestResult()
    suite.run(result)
    if LAST_FILL is not None:
        signal = LAST_FILL
        LAST_FILL = None
        raise signal
    if result.wasSuccessful():
        return
    if result.errors:
        raise RuntimeError(result.errors[0][1])
    if result.failures:
        raise AssertionError(result.failures[0][1])
    raise RuntimeError('test did not pass')


def solve_focused(workspace: Path, rel: str, qualname: str, src: str) -> str:
    current = src
    last = ''
    for _ in range(40):
        (workspace / rel).write_text(current, encoding='utf8')
        try:
            run_one(workspace, qualname)
            return current
        except FillSignal as signal:
            if signal.mode in ('not-equal', 'regex'):
                raise RuntimeError(f'{qualname} needs a manual answer ({signal.mode})') from None
            if signal.lineno:
                try:
                    current = replace_on_line(current, signal.lineno, signal.literal, signal.mode)
                except LookupError:
                    current = replace_first_blank(current, signal.literal)
            else:
                current = replace_first_blank(current, signal.literal)
            if current == last:
                raise RuntimeError(f'{qualname} stopped making progress') from None
            last = current
        except AssertionError as error:
            text = str(error)
            line_match = re.search(r'line (\d+)', text)
            snippet = ''
            if line_match:
                lineno = int(line_match.group(1))
                file_lines = current.splitlines()
                if 1 <= lineno <= len(file_lines):
                    snippet = file_lines[lineno - 1]
            if 'assert False' in snippet or 'assert False' in text.splitlines()[-1]:
                lineno = int(line_match.group(1)) if line_match else None
                if lineno:
                    current = replace_on_line(current, lineno, 'True', 'flip-false')
                    continue
            raise RuntimeError(f'{qualname} assertion was not a blank\n{text[-500:]}') from None
    raise RuntimeError(f'{qualname} did not converge')


def docstring_of(src: str, class_name: str, test_name: str) -> str:
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and item.name == test_name:
                    doc = ast.get_docstring(item) or ''
                    return textwrap.dedent(doc).strip()
    return ''


def test_names(src: str, class_name: str) -> list[str]:
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return [item.name for item in node.body if isinstance(item, ast.FunctionDef) and item.name.startswith('test_')]
    raise RuntimeError(f'missing class {class_name}')


def title_from(test_name: str) -> str:
    return test_name.removeprefix('test_').replace('_', ' ').strip().capitalize()


def module_display(filename: str) -> str:
    stem = filename.replace('about_', '').replace('.py', '').replace('_', ' ')
    return stem.title()


TRIANGLE_PART_1 = '''#!/usr/bin/env python
# -*- coding: utf-8 -*-

def triangle(a, b, c):
    if a == b == c:
        return 'equilateral'
    if a == b or b == c or a == c:
        return 'isosceles'
    return 'scalene'

class TriangleError(Exception):
    pass
'''

TRIANGLE_FULL = '''#!/usr/bin/env python
# -*- coding: utf-8 -*-

def triangle(a, b, c):
    sides = sorted((a, b, c))
    if sides[0] <= 0 or sides[0] + sides[1] <= sides[2]:
        raise TriangleError('illegal triangle')
    if a == b == c:
        return 'equilateral'
    if a == b or b == c or a == c:
        return 'isosceles'
    return 'scalene'

class TriangleError(Exception):
    pass
'''

SCORE_FN = '''def score(dice):
    counts = {}
    for face in dice:
        counts[face] = counts.get(face, 0) + 1
    total = 0
    for face, count in counts.items():
        triples, rest = divmod(count, 3)
        if triples:
            total += 1000 if face == 1 else face * 100
        if face == 1:
            total += rest * 100
        elif face == 5:
            total += rest * 50
    return total
'''

DICE_ROLL = '''    def roll(self, n):
        start = getattr(self, '_next', 1)
        self._values = [((start + offset - 1) % 6) + 1 for offset in range(n)]
        self._next = start + 1
'''

PROXY_CLASS = '''class Proxy:
    def __init__(self, target_object):
        self._messages = []
        self._obj = target_object

    def messages(self):
        return list(self._messages)

    def was_called(self, name):
        return name in self._messages

    def number_of_times_called(self, name):
        return self._messages.count(name)

    def __getattr__(self, name):
        self._messages.append(name)
        return getattr(self._obj, name)

    def __setattr__(self, name, value):
        if name in ('_messages', '_obj'):
            object.__setattr__(self, name, value)
            return
        self._messages.append(name)
        setattr(self._obj, name, value)
'''

FIND_LINE2 = '''    def find_line2(self, file_name):
        with self.FileContextManager(file_name) as file:
            for line in file.readlines():
                if 'e' in line:
                    return line
        return None
'''


def apply_project_answer(class_name: str, scaffold: str) -> str:
    if class_name == 'AboutTriangleProject':
        return TRIANGLE_PART_1
    if class_name == 'AboutTriangleProject2':
        return TRIANGLE_FULL
    if class_name == 'AboutScoringProject':
        return re.sub(r'def score\(dice\):.*?pass\n', SCORE_FN + '\n', scaffold, count=1, flags=re.S)
    if class_name == 'AboutDiceProject':
        return re.sub(r'    def roll\(self, n\):.*?pass\n', DICE_ROLL + '\n', scaffold, count=1, flags=re.S)
    if class_name == 'AboutProxyObjectProject':
        return re.sub(r'class Proxy:.*?class AboutProxyObjectProject', PROXY_CLASS + '\n\nclass AboutProxyObjectProject', scaffold, count=1, flags=re.S)
    raise RuntimeError(class_name)


def manual_answer(class_name: str, test_name: str, src: str) -> str | None:
    if class_name == 'AboutWithStatements' and test_name == 'test_finding_lines2':
        return re.sub(r'    def find_line2\(self, file_name\):.*?return None\n', FIND_LINE2 + '\n', src, count=1, flags=re.S)
    if class_name == 'AboutRegex' and test_name == 'test_matching_literal_text':
        return src.replace('re.search(__, string)', "re.search('Felix', string)", 1)
    if class_name == 'AboutRegex' and test_name == 'test_matching_any_character':
        return src.replace("change_this_search_string = 'a..xlx'", "change_this_search_string = 'a..xls'", 1)
    if class_name == 'AboutAttributeAccess' and test_name == 'test_setattr_intercepts_attribute_assignments':
        src = src.replace('self.assertEqual(__, fanboy.a_pie)', "self.assertEqual('blueberry', fanboy.a_pie)", 1)
        return src.replace("prefix = '__'", "prefix = 'my'", 1)
    if class_name == 'AboutRegex' and test_name == 'test_matching_set_character':
        return src.replace("change_this_search_string = '[nsc]a[2-9].xls'", "change_this_search_string = '[ns]a[12].xls'", 1)
    if class_name == 'AboutRegex' and test_name == 'test_anything_but_matching':
        return src.replace("change_this_search_string = '[^nc]am'", "change_this_search_string = 'sam.xls'", 1)
    if class_name == 'AboutClasses' and test_name == 'test_str_provides_a_string_version_of_the_object':
        return src.replace('            return __\n', '            return self._name\n', 1)
    return None


def hints_for(doc: str, project: bool) -> list[str]:
    first = doc.split('\n')[0].strip() if doc else ''
    if project:
        return [
            first or 'Read the comments above the function. They say what to return.',
            'Make one test pass, then run Check again. The failure names the case you missed.',
            'Look at the examples in the mission text before you rewrite the whole function.',
        ]
    return [
        first or 'This test is the mission. Make this one test pass.',
        'A blank `__` is a value. `___` is an exception type. `____` is True or False.',
        'Change the blank the failure is pointing at. Leave the rest of the test alone.',
    ]


def support_files(upstream: Path) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    for rel in ['contemplate_koans.py', 'example_file.txt', 'runner/__init__.py']:
        files.append({'name': rel, 'text': (upstream / rel).read_text(encoding='utf8')})
    files.append({'name': 'runner/koan.py', 'text': koan_source(upstream)})
    koans = upstream / 'koans'
    for path in sorted(koans.rglob('*')):
        if not path.is_file():
            continue
        if path.suffix not in {'.py', '.txt'}:
            continue
        rel = path.relative_to(upstream).as_posix()
        files.append({'name': rel, 'text': path.read_text(encoding='utf8')})
    return files


def guide_text() -> str:
    return textwrap.dedent('''\
        # Python Koans

        Python Koans is a port of the Ruby Koans. You learn by making one failing test pass.

        A blank `__` means "fill in a value". `___` means "name the exception type". `____` means True or False.

        The mission shows one test. Check runs that test in a local Python sandbox. When it passes, the next mission unlocks.

        Project missions (triangle, greed score, dice, proxy) are different: you write the function the tests call. The tests themselves are already filled in.

        The extra-credit greed game and the sample Television tests are not missions. Upstream left them as a free-form exercise and a fixture that already passes.
        ''').strip() + '\n'


def build(upstream: Path) -> dict:
    names: list[str] = []
    for line in (upstream / 'koans.txt').read_text(encoding='utf8').splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            names.append(line)

    workspace = Path(tempfile.mkdtemp(prefix='koans-build-'))
    prepare_workspace(upstream, workspace)
    modules = []
    levels = []
    failures: list[str] = []
    module_index: dict[str, int] = {}
    seen_projects: set[str] = set()

    try:
        for qual in names:
            module_name, class_name = qual.rsplit('.', 1)
            if class_name in SKIP_CLASSES:
                continue
            filename = module_name.split('.', 1)[1].replace('.', '/') + '.py'
            rel = f'koans/{filename}' if not filename.startswith('koans/') else filename
            # module_name is koans.about_asserts
            rel = 'koans/' + module_name.split('.', 1)[1].replace('.', '/') + '.py'
            original = (upstream / rel).read_text(encoding='utf8')
            file_key = Path(rel).name
            if file_key not in module_index:
                module_index[file_key] = len(modules) + 1
                modules.append({
                    'id': module_index[file_key],
                    'name': file_key.replace('.py', ''),
                    'display': module_display(file_key),
                    'slug': file_key.replace('.py', ''),
                    'blurb': f'Koans from {file_key}.',
                    'difficulty': 'koan',
                    'levelIds': [],
                })
            mod_id = module_index[file_key]

            if class_name in PROJECTS:
                if class_name in seen_projects:
                    continue
                seen_projects.add(class_name)
                edit = PROJECTS[class_name]
                tests = [f'{qual}.{name}' for name in test_names(original, class_name)]
                scaffold = (upstream / edit).read_text(encoding='utf8')
                if class_name == 'AboutTriangleProject2':
                    scaffold = TRIANGLE_PART_1
                answer = apply_project_answer(class_name, scaffold if class_name != 'AboutTriangleProject2' else (upstream / edit).read_text(encoding='utf8'))
                if class_name == 'AboutTriangleProject2':
                    answer = TRIANGLE_FULL
                doc = docstring_of(original, class_name, test_names(original, class_name)[0])
                objective = original if edit.endswith(Path(rel).name) else (upstream / rel).read_text(encoding='utf8')
                # Keep the mission text short enough to read: the class docstring area plus the task comment.
                if class_name.startswith('AboutTriangle'):
                    objective = (upstream / 'koans' / 'triangle.py').read_text(encoding='utf8')
                    if class_name == 'AboutTriangleProject2':
                        objective += '\n\nNow reject illegal triangles by raising TriangleError.'
                level_id = len(levels) + 1
                levels.append(make_level(level_id, mod_id, class_name, title_from(class_name), doc, True, scaffold, answer, edit, tests, 'project'))
                modules[mod_id - 1]['levelIds'].append(level_id)
                verify_answer(workspace, upstream, edit, answer, tests)
                continue

            for test_name in test_names(original, class_name):
                focused = drop_other_tests(original, class_name, test_name)
                qualname = f'{qual}.{test_name}'
                manual = manual_answer(class_name, test_name, focused)
                try:
                    if manual is not None:
                        answer = manual
                    else:
                        prepare_workspace(upstream, workspace)
                        answer = solve_focused(workspace, rel, qualname, focused)
                    verify_answer(workspace, upstream, rel, answer, [qualname])
                except Exception as error:
                    failures.append(f'{qualname}: {error.__class__.__name__}: {str(error).splitlines()[-1][:240]}')
                    continue
                doc = docstring_of(original, class_name, test_name)
                level_id = len(levels) + 1
                levels.append(make_level(
                    level_id, mod_id, test_name, title_from(test_name), doc, False,
                    focused, answer, rel, [qualname], 'fill-in',
                ))
                modules[mod_id - 1]['levelIds'].append(level_id)
    finally:
        shutil.rmtree(workspace, ignore_errors=True)

    if failures:
        print(f'{len(failures)} unsolved koans', file=sys.stderr)
        for item in failures:
            print(item, file=sys.stderr)
        raise RuntimeError(f'{len(failures)} unsolved koans')

    return {
        'source': {
            'title': 'Python Koans',
            'author': 'Greg Malcolm and The Status Is Not Quo',
            'license': 'MIT',
            'copyright': 'Copyright 2021 Greg Malcolm and The Status Is Not Quo',
            'url': 'https://github.com/gregmalcolm/python_koans',
            'branch': 'master',
            'revision': revision(upstream),
        },
        'guide': guide_text(),
        'support': support_files(upstream),
        'modules': modules,
        'levels': levels,
    }


def make_level(level_id, mod_id, slug, title, doc, project, scaffold, answer, edit, tests, kind) -> dict:
    return {
        'id': level_id,
        'module': mod_id,
        'title': title,
        'difficulty': 'project' if project else 'koan',
        'xp': 80 if project else 40,
        'objective': (doc + '\n\n' if doc else '') + (
            'Write the code the tests call. Check runs the whole project suite for this mission.'
            if project else
            'Make this one test pass. Replace the blank, or change the failing assert, then Check.'
        ),
        'concepts': [kind],
        'hints': hints_for(doc, project),
        'debrief': 'That test passes. The next mission is the next failing idea, not a new language.',
        'mistakes': 'A red test is the lesson. Read the expected value and the actual value once before you edit.',
        'guide': doc or 'Run the test, then change the one line it is complaining about.',
        'answer': answer,
        'scaffold': scaffold,
        'editPath': edit,
        'tests': tests,
    }


def verify_answer(workspace: Path, upstream: Path, edit: str, answer: str, tests: list[str]) -> None:
    prepare_workspace(upstream, workspace)
    (workspace / edit).write_text(answer, encoding='utf8')
    unload(workspace)
    sys.path.insert(0, str(workspace))
    os.chdir(workspace)
    # Verification uses real asserts, not the solver hooks.
    import runner.koan as koan
    importlib.reload(koan)
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    for name in tests:
        suite.addTest(loader.loadTestsFromName(name))
    result = unittest.TextTestRunner(stream=open(os.devnull, 'w'), verbosity=0).run(suite)
    if not result.wasSuccessful():
        detail = ''
        if result.failures:
            detail = result.failures[0][1][-800:]
        elif result.errors:
            detail = result.errors[0][1][-800:]
        raise RuntimeError(f'answer failed for {tests[0]}\n{detail}')


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: build-python-koans.py <upstream> <curriculum.json>', file=sys.stderr)
        sys.exit(1)
    upstream = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    curriculum = build(upstream)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(curriculum, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(f"Wrote {len(curriculum['levels'])} levels, {len(curriculum['modules'])} modules ({out.stat().st_size} bytes)")


if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
