FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 19000, 19001, 19002 are standard Expo ports; 8081 is the default Metro port
EXPOSE 8081
EXPOSE 19000
EXPOSE 19001

# Start the bundler with flags allowing external connections
CMD ["npx", "expo", "start", "--host", "lan"]
