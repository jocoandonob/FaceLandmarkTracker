// DOM elements
const uploadForm = document.getElementById('upload-form');
const imageInput = document.getElementById('image-input');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const processedContainer = document.getElementById('processed-container');
const processedImage = document.getElementById('processed-image');
const statusMessage = document.getElementById('status-message');
const uploadBtn = document.getElementById('upload-btn');
const retryBtn = document.getElementById('retry-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const webcamBtn = document.getElementById('webcam-btn');
const webcamContainer = document.getElementById('webcam-container');
const webcamVideo = document.getElementById('webcam-video');
const captureBtn = document.getElementById('capture-btn');
const webcamCanvas = document.getElementById('webcam-canvas');

// Initialize webcam variables
let stream = null;

// Event handler for form submission
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check if a file is selected
    if (imageInput.files.length === 0) {
        showStatus('Please select an image file.', 'danger');
        return;
    }
    
    const file = imageInput.files[0];
    
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
        showStatus('Please select a valid image file.', 'danger');
        return;
    }
    
    // Show loading spinner
    loadingSpinner.classList.remove('d-none');
    processedContainer.classList.add('d-none');
    uploadBtn.disabled = true;
    
    try {
        await processImage(file);
    } catch (error) {
        console.error('Error:', error);
        showStatus('An error occurred while processing the image.', 'danger');
    } finally {
        loadingSpinner.classList.add('d-none');
        uploadBtn.disabled = false;
    }
});

// Function to display preview of selected image
imageInput.addEventListener('change', () => {
    if (imageInput.files.length > 0) {
        const file = imageInput.files[0];
        
        // Check if the file is an image
        if (!file.type.startsWith('image/')) {
            showStatus('Please select a valid image file.', 'danger');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            previewContainer.classList.remove('d-none');
            processedContainer.classList.add('d-none');
            statusMessage.classList.add('d-none');
        };
        
        reader.readAsDataURL(file);
    }
});

// Function to process the image and show results
async function processImage(file) {
    // Create form data to send to the server
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/process-image/', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error processing image');
        }
        
        if (result.error) {
            showStatus(result.error, 'warning');
            return;
        }
        
        // Display the processed image with landmarks
        processedImage.src = `data:image/jpeg;base64,${result.image}`;
        processedContainer.classList.remove('d-none');
        
    } catch (error) {
        console.error('Error:', error);
        showStatus(`Error: ${error.message}`, 'danger');
    }
}

// Function to show status messages
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `alert alert-${type} mt-3`;
    statusMessage.classList.remove('d-none');
}

// Retry button handler
retryBtn.addEventListener('click', () => {
    imageInput.value = '';
    previewContainer.classList.add('d-none');
    processedContainer.classList.add('d-none');
    statusMessage.classList.add('d-none');
});

// Webcam functionality
webcamBtn.addEventListener('click', async () => {
    // Toggle webcam container visibility
    if (webcamContainer.classList.contains('d-none')) {
        try {
            // Start webcam
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamVideo.srcObject = stream;
            webcamContainer.classList.remove('d-none');
            previewContainer.classList.add('d-none');
            processedContainer.classList.add('d-none');
            webcamBtn.textContent = 'Close Camera';
        } catch (error) {
            console.error('Error accessing webcam:', error);
            showStatus('Unable to access webcam. Please grant permission or try another browser.', 'danger');
        }
    } else {
        // Stop webcam
        stopWebcam();
        webcamBtn.textContent = 'Use Camera';
    }
});

// Capture button handler
captureBtn.addEventListener('click', () => {
    if (!stream) return;
    
    // Draw the current video frame to the canvas
    const context = webcamCanvas.getContext('2d');
    webcamCanvas.width = webcamVideo.videoWidth;
    webcamCanvas.height = webcamVideo.videoHeight;
    context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
    
    // Convert the canvas to a Blob
    webcamCanvas.toBlob(async (blob) => {
        // Create a file from the blob
        const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });
        
        // Show loading spinner
        loadingSpinner.classList.remove('d-none');
        processedContainer.classList.add('d-none');
        
        try {
            await processImage(file);
            // Show the preview of the captured image
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                previewContainer.classList.remove('d-none');
            };
            reader.readAsDataURL(blob);
            
            // Close the webcam
            stopWebcam();
            webcamBtn.textContent = 'Use Camera';
        } catch (error) {
            console.error('Error:', error);
            showStatus('An error occurred while processing the captured image.', 'danger');
        } finally {
            loadingSpinner.classList.add('d-none');
        }
    }, 'image/jpeg', 0.9);
});

// Function to stop the webcam
function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    webcamContainer.classList.add('d-none');
}
