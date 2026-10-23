FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY servico2/ ./servico2/
EXPOSE 4000
CMD ["node", "servico2/index.js"]