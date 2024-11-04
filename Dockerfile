FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json .

RUN npm install --quiet

RUN npx prisma migrate

COPY . .

EXPOSE 3000

CMD [ "npm", "run", "dev" ]

