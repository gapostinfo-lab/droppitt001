# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Run stage ----------
FROM nginx:alpine

# Use your nginx.conf as the default server config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built output from the build stage into nginx html folder
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
