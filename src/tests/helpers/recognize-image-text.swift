// Local artifact OCR only. No UI control, uploads or network requests.
import Foundation
import Vision
import ImageIO

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: recognize-image-text <image-path>\n", stderr)
    exit(2)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fputs("Cannot decode image\n", stderr)
    exit(2)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.usesLanguageCorrection = false
request.minimumTextHeight = 0.005
try VNImageRequestHandler(cgImage: image).perform([request])
let rows: [[String: Any]] = (request.results ?? []).compactMap { observation in
    guard let result = observation.topCandidates(1).first else { return nil }
    let box = observation.boundingBox
    return ["text": result.string, "confidence": result.confidence,
            "x": box.minX, "y": 1 - box.maxY, "width": box.width, "height": box.height]
}
let data = try JSONSerialization.data(withJSONObject: rows, options: [.sortedKeys])
print(String(decoding: data, as: UTF8.self))
