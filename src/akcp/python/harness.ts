export interface PythonJob {
  root: string
  mode: 'unittest' | 'stdout'
  tests: string[]
  stdin: string
}

/**
 * One Python program runs inside the mission workspace.
 * Imports that can reach the network or the host process are refused.
 * open() may write only inside the workspace. Stdlib reads stay available.
 */
export function buildHarness(job: PythonJob): string {
  const encoded = JSON.stringify(JSON.stringify(job))
  return `import builtins, importlib, io, json, os, sys, traceback, types
JOB = json.loads(${encoded})
sys.dont_write_bytecode = True
sys.settrace(None)
runtime = sys.modules.get("__pt_runtime__")
if runtime is None:
    runtime = types.ModuleType("__pt_runtime__")
    runtime.real_open = builtins.open
    sys.modules["__pt_runtime__"] = runtime
real_open = runtime.real_open
builtins.open = real_open
root = JOB["root"]
os.chdir(root)
if root not in sys.path:
    sys.path.insert(0, root)
workspace = os.path.realpath(root)
for _name in list(sys.modules):
    if _name == "koans" or _name.startswith("koans.") or _name == "runner" or _name.startswith("runner."):
        sys.modules.pop(_name, None)
for _name, _mod in list(sys.modules.items()):
    _path = getattr(_mod, "__file__", None)
    if not isinstance(_path, str):
        continue
    try:
        _real = os.path.realpath(_path)
    except Exception:
        continue
    if _name in ("__main__", "__pt_runtime__"):
        continue
    if _real.endswith(os.sep + "_harness.py"):
        continue
    if _real == workspace or _real.startswith(workspace + os.sep):
        sys.modules.pop(_name, None)
importlib.invalidate_caches()
import unittest
import unittest.mock
_asyncio = sys.modules.get("asyncio")
BANNED = {
    "socket", "subprocess", "multiprocessing", "ctypes", "webbrowser",
    "urllib", "http", "ftplib", "smtplib", "poplib", "imaplib", "nntplib",
    "telnetlib", "xmlrpc", "ssl", "pty", "asyncio", "antigravity",
    "js", "pyodide", "micropip",
}
class _BanFinder:
    _pt_ban = True
    def find_spec(self, fullname, path, target=None):
        head = fullname.split(".")[0]
        if head in BANNED or fullname in BANNED:
            raise ImportError("blocked import: " + fullname)
        return None
sys.meta_path[:] = [item for item in sys.meta_path if not getattr(item, "_pt_ban", False)]
sys.meta_path.insert(0, _BanFinder())
for _name in list(sys.modules):
    if _name.split(".")[0] in BANNED:
        sys.modules.pop(_name, None)
def _blocked(*_args, **_kwargs):
    raise PermissionError("this operation is blocked in the mission sandbox")
if _asyncio is not None:
    for _name in ("open_connection", "start_server", "open_unix_connection", "start_unix_server"):
        if hasattr(_asyncio, _name):
            setattr(_asyncio, _name, _blocked)
    _base_loop = getattr(_asyncio, "BaseEventLoop", None)
    if _base_loop is not None:
        for _name in ("create_connection", "create_server", "create_unix_connection", "create_unix_server"):
            if hasattr(_base_loop, _name):
                setattr(_base_loop, _name, _blocked)
for _name in (
    "system", "popen", "execv", "execve", "execvp", "execvpe", "execl", "execlp", "execle",
    "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve", "spawnvp", "spawnvpe",
    "fork", "forkpty", "kill", "killpg",
):
    if hasattr(os, _name):
        setattr(os, _name, _blocked)
def _safe_exit(code=0):
    raise SystemExit(code)
sys.exit = _safe_exit
if hasattr(os, "_exit"):
    os._exit = _blocked
for _key in list(os.environ):
    _upper = _key.upper()
    if any(part in _upper for part in ("SECRET", "TOKEN", "PASSWORD", "CREDENTIAL")):
        os.environ.pop(_key, None)
    elif _upper.endswith("_KEY") or "_KEY_" in _upper or _upper.startswith("KEY_"):
        os.environ.pop(_key, None)
os.environ["TMPDIR"] = root
os.environ["TEMP"] = root
os.environ["TMP"] = root
os.environ["HOME"] = root
_read_roots = []
for _base in (getattr(sys, "base_prefix", ""), getattr(sys, "prefix", ""), os.path.dirname(getattr(os, "__file__", "") or "") or ""):
    if not _base:
        continue
    _real_base = os.path.realpath(_base)
    if _real_base and _real_base not in _read_roots:
        _read_roots.append(_real_base)
def _safe_open(file, mode="r", *args, **kwargs):
    if isinstance(file, int):
        return real_open(file, mode, *args, **kwargs)
    raw = file.__fspath__() if hasattr(file, "__fspath__") else file
    if isinstance(raw, bytes):
        raw = os.fsdecode(raw)
    text = str(raw)
    if text in ("/dev/null", "nul", os.devnull):
        return real_open(file, mode, *args, **kwargs)
    writing = any(flag in mode for flag in ("w", "a", "x", "+"))
    full = os.path.realpath(text if os.path.isabs(text) else os.path.join(workspace, text))
    if full == workspace or full.startswith(workspace + os.sep):
        return real_open(file, mode, *args, **kwargs)
    if not writing:
        for prefix in _read_roots:
            if prefix == os.sep:
                return real_open(file, mode, *args, **kwargs)
            if full == prefix or full.startswith(prefix + os.sep):
                return real_open(file, mode, *args, **kwargs)
    raise PermissionError("file access outside the mission workspace is blocked")
builtins.open = _safe_open
import unittest
_lines = 0
_LIMIT = 80000000
def _trace(frame, event, arg):
    global _lines
    if event == "line":
        _lines += 1
        if _lines > _LIMIT:
            raise RuntimeError("Your code ran too long and was stopped. Check for an infinite loop.")
    return _trace
payload = {"ok": False, "stdout": "", "error": "", "failures": [], "passed": 0, "total": 0}
def _friendly(exc):
    message = str(exc).strip()
    if "ran too long" in message or "blocked import" in message or "blocked" in message:
        return message[:800]
    detail = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    return detail[-800:]
try:
    sys.settrace(_trace)
    if JOB["mode"] == "stdout":
        inputs = JOB["stdin"].split("\\n") if JOB["stdin"] else []
        index = 0
        def _input(prompt=""):
            global index
            if index < len(inputs):
                value = inputs[index]
                index += 1
                return value
            return ""
        builtins.input = _input
        buffer = io.StringIO()
        sys.stdout = buffer
        sys.stderr = io.StringIO()
        source = real_open(os.path.join(workspace, "solution.py"), encoding="utf-8").read()
        compiled = compile(source, "solution.py", "exec")
        exec(compiled, {"__name__": "__main__", "__file__": "solution.py", "input": _input})
        payload["stdout"] = buffer.getvalue()[:20000]
        payload["ok"] = True
        payload["passed"] = 1
        payload["total"] = 1
    else:
        loader = unittest.TestLoader()
        suite = unittest.TestSuite()
        for name in JOB["tests"]:
            suite.addTests(loader.loadTestsFromName(name))
        stream = io.StringIO()
        result = unittest.TextTestRunner(stream=stream, verbosity=0).run(suite)
        failures = []
        for case, tb in list(result.failures) + list(result.errors):
            failures.append({"name": case.id(), "message": tb[-800:]})
        payload["failures"] = failures
        payload["total"] = result.testsRun
        payload["passed"] = max(0, result.testsRun - len(failures))
        payload["stdout"] = stream.getvalue()[:2000]
        payload["ok"] = bool(result.wasSuccessful() and result.testsRun > 0)
        if result.testsRun == 0:
            payload["error"] = "No tests ran."
except SystemExit as exc:
    code = exc.code
    payload["ok"] = code in (0, None)
    if not payload["ok"]:
        payload["error"] = "exited with status %s" % (code,)
except BaseException as exc:
    payload["ok"] = False
    payload["error"] = _friendly(exc)
finally:
    sys.settrace(None)
    builtins.open = real_open
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
    try:
        with real_open(os.path.join(workspace, "_result.json"), "w", encoding="utf-8") as handle:
            handle.write(json.dumps(payload))
    except Exception as exc:
        sys.stderr.write(str(exc))
`
}
