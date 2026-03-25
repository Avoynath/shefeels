import py_compile
import pathlib
import sys

errors = 0
for p in pathlib.Path('.').rglob('*.py'):
	try:
		py_compile.compile(str(p), doraise=True)
	except Exception as e:
		print('ERROR compiling', p, e)
		errors += 1

if errors:
	sys.exit(1)
else:
	print('All files compiled successfully')
