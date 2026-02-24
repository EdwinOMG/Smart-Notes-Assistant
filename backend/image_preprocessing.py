import cv2
import numpy as np
from typing import List
# apply multiple preprocessing techniques to the image and return a list of the images
def preprocess_image(image_bytes: bytes) -> List[bytes]:
    print("Preprocessing THE IMAGE!!!!!")
    
    # Convert the byes to a numpy array, then to an opencv image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    processed_versions = []
    
    # Convert to a grayscale first
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    processed_versions.append(gray)
    print("Grayscale image created: ", processed_versions)

    # denoise the grayscale image
    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    processed_versions.append(denoised)
    print("denoised image: ", processed_versions)

    # appply Otsu's thresholding to the grayscale image
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    processed_versions.append(binary)
    print("thresholding created", processed_versions)


    # apply adaptive thresholding to the grayscale image
    adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    processed_versions.append(adaptive)
    print("adaptive thresholding created: ", processed_versions)


    
    # apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to the grayscale image
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    processed_versions.append(enhanced)
    print("CLAHE enhanced image created: ", processed_versions)



    # convert them back to bytes
    result_bytes = []
    for processed in processed_versions:
        _, buffer = cv2.imencode('.png', processed)
        result_bytes.append(buffer.tobytes())
    
    return result_bytes