FROM node:20-alpine

WORKDIR /app

# Paket tanımlarını kopyala ve bağımlılıkları yükle
COPY package*.json ./
RUN npm ci --only=production

# Proje dosyalarını kopyala
COPY . .

# Ortam Değişkenleri
ENV NODE_ENV=production
ENV PORT=7635
ENV HOST=0.0.0.0

EXPOSE 7635

CMD ["npm", "start"]
