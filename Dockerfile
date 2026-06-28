# Build stage
FROM node:20-alpine as build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Serve stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
