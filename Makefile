.PHONY : eslint jscs

all : eslint jscs

eslint : node_modules
	node_modules/.bin/eslint graafi.js

jscs : node_modules
	node_modules/.bin/jscs graafi.js

node_modules :
	npm install eslint jscs
