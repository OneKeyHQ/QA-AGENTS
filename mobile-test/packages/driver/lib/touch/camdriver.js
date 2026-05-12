import NodeWebcam from 'node-webcam';
import sharp from 'sharp';

console.log(NodeWebcam);

// Default options
const opts = {
  // Picture related
  saveShots: true,
  width: 1280,
  height: 1280,
  quality: 100,

  // Number of frames to capture
  frames: 60,

  // Delay in seconds to take shot
  delay: 0.1,

  // Which camera to use
  device: 'YW500',

  // Return type
  callbackReturn: 'buffer',

  // Logging
  verbose: false,
};

// Creates webcam instance
const Webcam = NodeWebcam.create(opts);

// Capture image
Webcam.capture('test_picture', function (err, data) {
  sharp(data)
    .rotate(91) // 旋转角度
    .toFile('rotated_picture.jpg', (err, info) => {
      if (err) {
        console.log(err);
      } else {
        console.log('Image rotated!');
      }
    });
});

// Get list of cameras
Webcam.list(function (list) {
  console.log(list);
});
