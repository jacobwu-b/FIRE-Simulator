.PHONY: setup dev test lint format type-check build clean

setup:
	npm install

dev:
	npm run dev

test:
	npm run test

lint:
	npm run lint

format:
	npm run format

type-check:
	npm run type-check

build:
	npm run build

clean:
	rm -rf node_modules dist .vitest
