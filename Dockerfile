FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV HOOSHYAR_HOST=0.0.0.0
ENV HOOSHYAR_DB_PATH=/data/hooshyar.sqlite

RUN mkdir -p /data

EXPOSE 4173

CMD ["npm", "run", "start:commercial"]
