import re
text = 'አዎ ትክክል ነው'
print('Has \u12a0\u12ce:', bool(re.search(r'\b\u12a0\u12ce\b', text)))
print('Regex without b:', bool(re.search(r'\u12a0\u12ce', text)))
