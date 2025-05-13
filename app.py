import os
import numpy as np
import cv2
import dlib
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import List
import base64
from starlette.requests import Request
import logging
import tempfile
import shutil

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize the FastAPI app
app = FastAPI()

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Initialize dlib's face detector
detector = dlib.get_frontal_face_detector()  # type: ignore

# We'll initialize the predictor after downloading the model
predictor = None  # Will be initialized to dlib.shape_predictor

# Function to download the shape predictor model if it doesn't exist
@app.on_event("startup")
async def download_shape_predictor():
    import urllib.request
    import bz2
    global predictor
    
    model_path = "shape_predictor_68_face_landmarks.dat"
    if not os.path.exists(model_path):
        logger.info("Downloading shape predictor model...")
        try:
            # URL for the 68 facial landmark predictor from dlib
            url = "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
            compressed_path = "shape_predictor_68_face_landmarks.dat.bz2"
            
            # Download the compressed file
            urllib.request.urlretrieve(url, compressed_path)
            
            # Decompress the file
            with bz2.BZ2File(compressed_path) as f_in:
                with open(model_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            # Remove the compressed file
            os.remove(compressed_path)
            logger.info("Shape predictor model downloaded and extracted successfully")
        except Exception as e:
            logger.error(f"Error downloading model: {str(e)}")
    
    try:
        # Initialize the predictor with the model file
        predictor = dlib.shape_predictor(model_path)  # type: ignore
        logger.info("Facial landmark predictor initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing predictor: {str(e)}")

# Route for the home page
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Function to detect faces and landmarks
def detect_facial_landmarks(image_data):
    # Make sure predictor is initialized
    if predictor is None:
        return None, "Facial landmark predictor is not initialized yet. Please try again in a moment."
    
    # Convert the image to grayscale for face detection
    gray = cv2.cvtColor(image_data, cv2.COLOR_BGR2GRAY)
    
    # Detect faces in the grayscale image
    faces = detector(gray)
    
    if len(faces) == 0:
        return None, "No faces detected in the image"
    
    # Create a copy of the image to draw landmarks on
    result_image = image_data.copy()
    
    landmarks_list = []
    
    # Process each detected face
    for face in faces:
        # Predict facial landmarks
        landmarks = predictor(gray, face)
        
        # Convert dlib's rectangle to a list for JSON serialization
        face_rect = {
            "left": face.left(),
            "top": face.top(),
            "right": face.right(),
            "bottom": face.bottom()
        }
        
        # Convert landmarks to a list of (x, y) coordinates
        face_landmarks = []
        for i in range(68):  # There are 68 facial landmarks
            x = landmarks.part(i).x
            y = landmarks.part(i).y
            face_landmarks.append({"x": x, "y": y})
            
            # Draw a small circle at the landmark position
            cv2.circle(result_image, (x, y), 2, (0, 255, 0), -1)
        
        landmarks_list.append({
            "face": face_rect,
            "landmarks": face_landmarks
        })
    
    # Convert the result image to base64 for display
    _, buffer = cv2.imencode('.jpg', result_image)
    img_str = base64.b64encode(buffer).decode('utf-8')
    
    return {
        "image": img_str,
        "landmarks": landmarks_list
    }, None

# API endpoint to process uploaded images
@app.post("/process-image/")
async def process_image(file: UploadFile = File(...)):
    # Check if the file is an image
    content_type = file.content_type
    if content_type is None or not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read the image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Could not read the image")
        
        # Process the image to detect facial landmarks
        result, error = detect_facial_landmarks(img)
        
        if error:
            return JSONResponse(content={"error": error}, status_code=400)
        
        return JSONResponse(content=result)
    
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}
