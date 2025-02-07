import openai
from flask import Flask, request, jsonify
import json
import os
from flask_cors import CORS
import PyPDF2

app = Flask(__name__)
CORS(app)

# Set your OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY");


# Paths
POLICIES_FOLDER = "./policies"
VECTOR_DB_FILE = "vector_db_policies.json"

# Initialize an in-memory vector database
VECTOR_DB = {}

# Function to load dataset from a text file
def load_text_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        return chunk_text(content)
    except Exception as e:
        print(f"Error loading file {file_path}: {e}")
        return []

# Function to extract text from a PDF file
def extract_text_from_pdf(file_path):
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = "\n".join([page.extract_text() or "" for page in pdf_reader.pages])
        return chunk_text(text)
    except Exception as e:
        print(f"Error extracting text from PDF {file_path}: {e}")
        return []

# Split text into smaller chunks for embeddings
def chunk_text(text, chunk_size=300):
    words = text.split()
    return [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]

# Create embeddings for a given text chunk
def create_embedding(text):
    try:
        response = openai.embeddings.create(
            model="text-embedding-ada-002",
            input=[text]
        ).data[0].embedding
        return response
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None

# Add paragraphs to the database
def add_paragraphs_to_db(file_name, paragraphs):
    vector_db = []
    for paragraph in paragraphs:
        embedding = create_embedding(paragraph)
        if embedding:
            vector_db.append((paragraph, embedding))
    if vector_db:
        VECTOR_DB[file_name] = vector_db



# Save vector database to file
def save_vector_db():
    serializable_db = [
        {"file_name": file_name, "paragraph": paragraph, "embedding": embedding}
        for file_name, paragraphs in VECTOR_DB.items()
        for paragraph, embedding in paragraphs
    ]
    with open(VECTOR_DB_FILE, 'w', encoding='utf-8') as file:
        json.dump(serializable_db, file, ensure_ascii=False, indent=4)

# Load vector database from file
def load_vector_db():
    global VECTOR_DB
    if os.path.exists(VECTOR_DB_FILE):
        try:
            with open(VECTOR_DB_FILE, 'r', encoding='utf-8') as file:
                data = json.load(file)
            for entry in data:
                if entry["file_name"] not in VECTOR_DB:
                    VECTOR_DB[entry["file_name"]] = []
                VECTOR_DB[entry["file_name"]].append((entry["paragraph"], entry["embedding"]))
        except Exception as e:
            print(f"Error loading vector database: {e}")

# Cosine similarity calculation
def cosine_similarity(a, b):
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x ** 2 for x in a) ** 0.5
    norm_b = sum(x ** 2 for x in b) ** 0.5
    return dot_product / (norm_a * norm_b) if norm_a and norm_b else 0.0

# Retrieve relevant paragraphs based on query
def retrieve(query, top_n=2):
    similarities = []
    query_embedding = create_embedding(query)
    if not query_embedding:
        return []
    for file_name, vector_db in VECTOR_DB.items():
        similarities.extend([
            (chunk, cosine_similarity(query_embedding, embedding))
            for chunk, embedding in vector_db
        ])
    similarities.sort(key=lambda x: x[1], reverse=True)
    return similarities[:top_n]

# Generate chatbot response
def generate_response(query, retrieved_knowledge):
    context = "\n".join([f" - {chunk}" for chunk, _ in retrieved_knowledge])
    prompt = (
        "You are an AI specializing in company policies. Answer professionally, without referencing documents. "
        "If more details are needed, ask what aspect to elaborate on. If unsure, reply: "
        "'I'm sorry, but I don't have the necessary details to answer this.'\n"
        f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
    )
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "system", "content": prompt}],
            max_tokens=200,
            temperature=0,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating response: {e}")
        return "I couldn't generate a response at this moment."

# Handle policy embedding
def handle_policy():
    for filename in os.listdir(POLICIES_FOLDER):
        if filename.endswith(".txt") or filename.endswith(".pdf"):
            if filename not in VECTOR_DB:
                file_path = os.path.join(POLICIES_FOLDER, filename)
                paragraphs = load_text_file(file_path) if filename.endswith(".txt") else extract_text_from_pdf(file_path)
                add_paragraphs_to_db(filename, paragraphs)
    save_vector_db()

# API: Query policy endpoint
@app.route('/api/query', methods=['POST'])
def query_policy():
    data = request.get_json()
    user_query = data.get("query")
    if not os.path.exists(VECTOR_DB_FILE):
        return jsonify({"error": "Vector database not found. Train the model first."}), 400
    load_vector_db()
    retrieved_knowledge = retrieve(user_query)
    if not retrieved_knowledge:
        return jsonify({"error": "No relevant information found."}), 400
    response = generate_response(user_query, retrieved_knowledge)
    return jsonify({"response": response})

# API: Train policy embedding
@app.route('/api/train', methods=['POST'])
def train_policies():
    handle_policy()
    return jsonify({"message": "All policy files have been processed and embedded."})

# Load vector database on startup
load_vector_db()

if __name__ == "__main__":
    app.run(debug=True)
