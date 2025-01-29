# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application into the container
COPY . .

# Expose the port that Streamlit uses
EXPOSE 8501

# Command to run the Streamlit app
CMD ["streamlit", "run", "Home.py", "--server.port=8501", "--server.address=0.0.0.0"]
