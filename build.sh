#!/bin/sh
docker compose down
export BUILD_COMMIT=$(git rev-parse --short HEAD)
export BUILD_DATE=$(git log -1 --format=%ci HEAD | cut -c1-10)
docker compose up -d --build "$@"
