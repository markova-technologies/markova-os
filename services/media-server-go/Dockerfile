FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o media-server-go .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/media-server-go .
EXPOSE 10000/udp
CMD ["./media-server-go"]
