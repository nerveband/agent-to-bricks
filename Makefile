.PHONY: build test clean install lint

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
DATE    ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS  = -s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.date=$(DATE)

build:
	cd cli && CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o ../bin/bricks .

test:
	cd cli && go test ./...

test-verbose:
	cd cli && go test -v ./...

clean:
	rm -rf bin/

install: build
	cp bin/bricks /usr/local/bin/bricks

lint:
	cd cli && go vet ./...

snapshot:
	cd cli && goreleaser release --snapshot --clean

# Plugin deployment
deploy-staging:
	./scripts/deploy-staging.sh
