FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o voice-runtime-go .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/voice-runtime-go .
EXPOSE 5008
CMD ["./voice-runtime-go"]
