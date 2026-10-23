FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY servico1/ ./servico1/
EXPOSE 3000
CMD ["node", "servico1/index.js"]