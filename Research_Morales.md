Research on project:
https://medium.com/@jameschen_78678/enhancing-image-text-extraction-with-llm-and-ocr-8221cb555cc5
Discusses how to enhance text extraction from an image using a llm.

https://pyimagesearch.com/2021/11/22/improving-ocr-results-with-basic-image-processing/
Walks through processing an image through three filters
Grayscale filter - Uses binary inverse to grayscale the image to make the text pop more
Distance transform - Calculates distance from each pixel used to clean up alot of the noise in the background
Opening Morphological Operation - Disconnects connected blobs and removes noise




Image Enhancement Pipeline - 

Original - Grayscale - Contrast enhancement(CLAHE) - Denoise - Adaptive threshold - Morphology - Resize - OCR 



Key Filters:

Contrast Limited Adaptive Histogram Equalization: 
Contrast - Increasing contract to make text pop by strengthening the difference between the text 
and background

Sharpen Mask - Increase local contast along the edges of letters to improve legibility

High-Pass Filter - Reduces low-frequency information(background noise) while keeping high-frequency 
details

Threshold - Converting the image to black and white and adjusting the threshold

Despeckle/Noise Reduction: If the image is grainy, reducing the noise helps text stand out


