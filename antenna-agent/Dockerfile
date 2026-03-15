# ============================================================
# Stage 1: Build the antenna binary
# ============================================================
FROM golang:1.26.0-alpine AS builder

RUN apk add --no-cache git make

WORKDIR /src

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN make build

# ============================================================
# Stage 2: Minimal runtime image
# ============================================================
FROM alpine:3.23

RUN apk add --no-cache ca-certificates tzdata curl wget

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:18790/health || exit 1

# Copy binary
COPY --from=builder /src/build/antenna /usr/local/bin/antenna

# Create non-root user and group
RUN addgroup -g 1000 antenna && \
    adduser -D -u 1000 -G antenna antenna

# Run onboard as root to create initial directories
RUN /usr/local/bin/antenna onboard

# Change ownership of antenna directory
RUN chown -R antenna:antenna /root/.antenna

# Switch to non-root user
USER antenna

ENTRYPOINT ["antenna"]
CMD ["gateway"]
