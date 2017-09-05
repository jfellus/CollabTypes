SOURCES:=$(shell find src -name "*.js")


all: dist/collab.js dist/collab.min.js

dist/collab.js: $(SOURCES)
	browserify src/client.js > $@

dist/collab.min.js: dist/collab.js
	uglifyjs $^ > $@
