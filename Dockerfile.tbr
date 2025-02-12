FROM node:20.13.0-alpine3.19 AS build

WORKDIR /app

COPY . .

RUN npm install && apk update && apk upgrade

EXPOSE 3000
CMD ["npx ts-node /app/src/main.ts" ]