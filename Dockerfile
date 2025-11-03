# Use Nginx to serve static files
FROM nginx:alpine

# Copy your static site HTML, CSS, JS, data, etc. into the Nginx web root
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
