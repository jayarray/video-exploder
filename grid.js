let Path = require('path');
let LinuxCommands = require('linux-commands-async');
let Ffmpeg = require('ffmpeg-async');
let ImageMagick = require('imagemagick-async');
let ProjectFolder = require('nodejs-project-folder');

//---------------------

// TEMP DIR

let pathBuilder = new ProjectFolder.PathBuilder();
pathBuilder.currentProjectAsRoot();
pathBuilder.append('temp');

let tempDir = pathBuilder.fullPath();

// GUID

pathBuilder = new ProjectFolder.PathBuilder();
pathBuilder.currentProjectAsRoot();
pathBuilder.append('guid.js');

let Guid = require(pathBuilder.fullPath());

//---------------------

class GridItem {
  constructor(builder) {
    this.width = builder.args.width;
    this.height = builder.args.height;
    this.source = builder.args.source;
  }

  static get Builder() {
    class Builder {
      constructor() {
        this.args = {
          width: 200,
          height: 200,
          effects: []
        };
      }

      width(n) {
        this.args.width = n;
        return this;
      }

      height(n) {
        this.args.height = n;
        return this;
      }

      addEffect(e) {
        this.args.effects.push(e);
        return this;
      }

      addEffects(arr) {
        this.args.effects = this.args.effects.concat(arr);
        return this;
      }

      /**
       * @param {string} str Video source path
       */
      source(str) {
        this.args.source = str;
        return this;
      }

      build() {
        return new GridItem(this);
      }
    }

    return new Builder();
  }
}

//-------------------------------
// HELPER FUNCTIONS

/**
 * Convert video to an image sequence.
 * @param {string} videoSrc 
 * @param {string} seqName 
 * @param {string} imgFormat 
 * @param {number} fps 
 * @returns {Promise<{dir: string, filepaths: Array<string>, destFormatStr: string}>} Returns a Promise with the following properties: dir, filepaths, destFormatStr.
 */
function ToImageSequence(videoSrc, seqName, imgFormat, fps) {
  return new Promise((resolve, reject) => {

    // Create a directory

    let imgSeqDir = Path.join(tempDir, Guid.Create());

    LinuxCommands.Mkdir.MakeDirectory(imgSeqDir, LinuxCommands.Command.LOCAL).then(success => {
      Ffmpeg.Video.EstimatedFrames(videoSrc, fps).then(estimatedFrames => {
        let formatStr = `${seqName}_%`;
        let numberStr = estimatedFrames.toString();

        if (numberStr.length < 10)
          formatStr += `0${numberStr.length}`;
        else
          formatStr += estimatedFrames.toString();
        formatStr += `d.${imgFormat}`;

        let destFormatStr = Path.join(tempDir, formatStr);
        let frameStartNumber = 1;

        Ffmpeg.Video.ExtractImages(videoSrc, destFormatStr, frameStartNumber, fps).then(success => {

          // Get paths for all rendered images

          let pattern = Path.join(imgSeqDir, `${seqName}_*.${imgFormat}`);
          LinuxCommands.Find.FilesByName(imgSeqDir, pattern, 1, LinuxCommands.Command.LOCAL).then(paths => {

            // Sort paths
            paths.paths.sort();
            let filepaths = paths.paths;

            // Return img seq dir and list of filepaths
            resolve({
              dir: imgSeqDir,
              filepaths: filepaths,
              destFormatStr: destFormatStr
            });
          }).catch(error => reject(error));
        }).catch(error => reject(error));
      }).catch(error => reject(error));
    }).catch(error => reject(error));
  });
}

/**
 * Resize a list of images.
 * @param {Array<string>} sources 
 * @param {number} width 
 * @param {number} height 
 * @returns {Promise} Returns a Promise that resolves if successful.
 */
function ResizeImages(sources, width, height) {
  return new Promise((resolve, reject) => {

    let resize = (srcArr) => {
      return new Promise((resolve, reject) => {
        if (srcArr.length == 0) {
          resolve();
          return;
        }

        let currSrc = sources[0];

        // Create resize

        let resizedTransform = ImageMagick.Api.Drawables.Transform.Resize.ResizeDimensions.Builder
          .source(currSrc)
          .width(width)
          .height(height)
          .build();

        let resizeLayer = ImageMagick.Api.Layer.Layer.Builder
          .foundation(resizedTransform)
          .build();

        // Render image

        let renderer = ImageMagick.Api.Render.Renderer.Builder
          .layer(resizeLayer)
          .format('png')
          .outputPath(currSrc)
          .build();

        renderer.Render().then(success => {
          resolve(resize(sources.slice(1)));
        }).catch(error => reject(error));
      });
    };

    resize(sources).then(success => {
      resolve();
    }).catch(error => reject(error));
  });
}

/**
 * Overlays an image onto the specified canvas.
 * @param {string} src 
 * @param {object} canvas 
 * @returns {Promise} Returns a Promise that resolves if successful.
 */
function PlaceImageOnCanvas(src, canvas) {
  return new Promise((resolve, reject) => {

    // Create canvas layer

    let canvasLayer = ImageMagick.Api.Layer.Layer.Builder
      .foundation(canvas)
      .gravity('Center')
      .build();

    // Create image layer

    let imageCanvas = ImageMagick.Api.Drawables.Canvases.ImageCanvas.Builder
      .source(src)
      .width(1)
      .height(1)
      .build();

    let imageLayer = ImageMagick.Api.Layer.Layer.Builder
      .foundation(imageCanvas)
      .offset({ x: widthShift * r, y: heightShift * c })
      .build();

    // Add image to canvas layer
    canvasLayer.overlay(imageLayer);

    // Render image

    let renderer = ImageMagick.Api.Render.Renderer.Builder
      .layer(canvasLayer)
      .format('png')
      .outputPath(src)
      .build();

    renderer.Render().then(success => {
      resolve();
    }).catch(error => reject(error));
  });
}

/**
 * Get a 2-dimensional array of filepaths representing the grid.
 * @param {Array} items 
 * @param {object} videoMap 
 * @param {number} minLength 
 * @param {number} rows 
 * @param {number} columns 
 * @returns {Array<Array<string>>} Returns an array of objects with filepath and gridItem as properties.
 */
function To2dFilepathList(items, videoMap, minLength, rows, columns) {
  let list = [];

  for (let i = 0; i < minLength; ++i) {
    let tmp2dArr = [];

    for (let r = 0; r < rows; ++r) {
      for (let c = 0; c < columns; ++c) {
        let currItem = items[r][c];
        let currFilepath = videoMap[currItem.source].filepaths[i];

        tmp2dArr[r][c] = currFilepath;
      }
    }

    list.push(tmp2dArr);
  }

  return list;
}

/**
 * Convert a 2-dimensional filepath list into a grid image.
 * @param {Array<Array<string>>} filepath2dList 
 * @param {number} width Grid width
 * @param {height} height Grid height
 * @param {number} xOffset GridItem width
 * @param {number} yOffset GridItem height
 * @param {string} seqName
 * @param {string} imgFormat
 * @param {string} destDir Desired directory
 * @returns {Promise} Returns a Promise that resolves if successful.
 */
function ToGridImages(filepath2dList, width, height, xOffset, yOffset, seqName, imgFormat, destDir) {
  return new Promise((resolve, reject) => {

    let rows = filepath2dList[0];
    let columns = filepath2dList[0].length;
    let currFrameNumber = 1;
    let frameCount = filepath2dList.length;

    let toGridImg = (list) => {
      return new Promise((resolve, reject) => {
        if (list.length == 0) {
          resolve();
          return;
        }

        let curr2dArr = filepath2dList[0];

        // Create blank canvas

        let canvasColor = ImageMagick.Api.Inputs.Color.Builder
          .format('string')
          .hexString('#00000000')
          .build();

        let blankCanvas = ImageMagick.Api.Drawables.Canvases.ColorCanvas.Builder
          .width(width)
          .height(height)
          .color(canvasColor)
          .build();

        let canvasLayer = ImageMagick.Api.Layer.Layer.Builder
          .foundation(blankCanvas)
          .gravity('NorthWest')
          .build();

        for (let r = 0; r < rows; ++r) {
          for (let c = 0; c < columns; ++c) {
            let currPath = curr2dArr[r][c];

            let imageCanvas = ImageMagick.Api.Drawables.Canvases.ImageCanvas.Builder
              .source(currPath)
              .width(1)
              .height(1)
              .build();

            let imageLayer = ImageMagick.Api.Layer.Layer.Builder
              .foundation(imageCanvas)
              .offset({ x: xOffset * r, y: yOffset * c })
              .build();

            canvasLayer.overlay(imageLayer);
          }
        }

        // Render image

        let numLength = frameCount.toString().length;

        let numStr = `0`.repeat(numLength);
        numStr += currFrameNumber.toString();

        let endIndex = numStr.length;
        let startIndex = endIndex - numLength;
        numStr = numStr.substr(startIndex, endIndex);

        let filename = `${seqName}_${numStr}.${imgFormat}`;
        let outputPath = Path.join(destDir, filename);

        let renderer = ImageMagick.Api.Render.Renderer.Builder
          .layer(canvasLayer)
          .format('png')
          .outputPath(outputPath)
          .build();

        renderer.Render().then(success => {
          currFrameNumber += 1;
          resolve(toGridImg(list.slice(1)));
        }).catch(error => reject(error));
      });
    };

    toGridImg(filepath2dList).then(success => {
      resolve();
    }).catch(error => reject(error));
  });
}

//-------------------------------

class Grid {
  constructor(builder) {
    this.rows = builder.args.rows;
    this.columns = builder.args.columns;
    this.itemWidth = builder.args.itemWidth;
    this.itemHeight = builder.args.itemHeight;

    // Set items 2D array

    this.items = [];

    for (let r = 0; r < this.rows; ++r) {
      let row = [];

      for (let c = 0; c < this.columns; ++c) {
        row.push(null);
      }

      this.items.push(row);
    }
  }

  static get Build() {
    class Builder {
      constructor() {
        this.args = {
          rows: 1,
          columns: 1,
          itemWidth: 200,
          itemHeight: 200
        };
      }

      rows(n) {
        this.args.rows = n;
        return this;
      }

      columns(n) {
        this.args.columns = n;
        return this;
      }

      itemWidth(n) {
        this.args.itemWidth = n;
        return this;
      }

      itemHeight(n) {
        this.args.itemHeight = n;
        return this;
      }

      build() {
        return new Grid(this);
      }
    }

    return new Builder();
  }

  /**
   * @param {GridItem} i 
   * @param {number} r 
   */
  AddItemToRow(i, r) {
    if (r > this.items.length)
      return;

    let currRow = this.items[r];
    currRow.push(i)
  }

  /**
   * @param {GridItem} i 
   * @param {number} r 
   * @param {number} c 
   */
  AddItem(i, r, c) {
    if (r > this.items.length)
      return;

    let currRow = this.items[r];

    if (c > this.currRow.length)
      return;

    let currItem = currRow[c];
    currItem = i;
  }

  /**
   * @param {string} seqName 
   * @param {string} imgFormat 
   * @param {number} fps 
   * @param {string} destDir Desired directory
   */
  Render(seqName, imgFormat, fps, destDir) {
    return new Promise((resolve, reject) => {
      let videoMap = {};
      let videoPaths = [];

      for (let r = 0; r < this.rows; ++r) {
        for (let c = 0; c < this.columns; ++c) {
          let currItem = this.items[r][c];
          let currSource = currItem.source;

          videoMap[currSource] = { gridItem: currItem };
          videoPaths.push(currSource);
        }
      }

      // Convert all video sources into image sequences

      let currSeqNumber = 0;
      let infoArr = [];

      let convert = (vPaths) => {
        return new Promise((resolve, reject) => {
          if (!vPaths || vPaths.length == 0) {
            resolve();
            return;
          }

          let currVpath = vPaths[0];
          let currSeqName = `temp_seq_${currSeqNumber}`;

          ToImageSequence(currVpath, currSeqName, imgFormat, fps).then(info => {
            videoMap[currVpath].info = info;
            infoArr.push(info);
            currSeqNumber += 1;

            resolve(convert(vPaths.slice(1)));
          }).catch(error => reject(error));
        });
      };

      convert(videoPaths).then(success => {
        let keys = Object.keys(videoMap);
        let minLength = Number.MAX_SAFE_INTEGER;

        // Get min size of filepaths

        keys.forEach(k => {
          let currInfo = videoMap[k];
          let currFilepaths = currInfo.filepaths

          if (currFilepaths.length < minLength)
            minLength = currFilepaths.length;
        });

        // Shrink filepaths to min size

        keys.forEach(k => {
          let currInfo = videoMap[k];
          currInfo.filepaths = currInfo.filepaths.slice(0, minLength);
        });

        // Shrink images accordingly

        let resize = (vPaths) => {
          return new Promise((resolve, reject) => {
            if (vPaths.length == 0) {
              resolve();
              return;
            }

            let currPath = vPaths[0];
            let currMapping = videoMap[currPath];
            let currItem = currMapping.gridItem;
            let currFilepaths = currMapping.info.filepaths;

            ResizeImages(currFilepaths, currItem.width, currItem.height).then(success => {
              resolve(resize(vPaths.slice(1)));
            }).catch(error => reject(error));
          });
        };

        resize(videoPaths).then(success => {

          // Place resized images on top of a blank canvas

          let reCanvas = (filepaths) => {
            return new Promise((resolve, reject) => {
              if (filepaths.length == 0) {
                resolve();
                return;
              }

              let currFilepath = filepaths[0];

              // Create blank canvas

              let canvasColor = ImageMagick.Api.Inputs.Color.Builder
                .format('string')
                .hexString('#00000000')
                .build();

              let blankCanvas = ImageMagick.Api.Drawables.Canvases.ColorCanvas.Builder
                .width(this.width)
                .height(this.height)
                .color(canvasColor)
                .build();

              PlaceImageOnCanvas(currFilepath, blankCanvas).then(success => {
                resolve(reCanvas(filepaths.slice(1)));
              }).catch(error => reject(error));
            });
          };


          let filepaths = [];

          videoPaths.forEach(v => {
            let currFilepaths = videoMap[v].info.filepaths;
            filepaths = filepaths.concat(currFilepaths);
          });


          reCanvas(filepaths).then(success => {

            // Create grid images

            let filepath2dList = To2dFilepathList(this.items, videoMap, minLength, this.rows, this.columns);
            let xOffset = this.itemWidth / this.columns;
            let yOffset = this.itemHeight / this.rows;

            ToGridImages(filepath2dList, this.width, this.height, xOffset, yOffset, seqName, imgFormat, destDir).then(success => {

              // Cleanup temp files

              let keys = Object.keys(videoMap);
              let cleanupDirs = [];

              keys.forEach(k => {
                let currMapping = videoMap[k];
                cleanupPaths = cleanupPaths.concat(currMapping.info.dir);
              });

              LinuxCommands.Remove.Directories(cleanupDirs, LinuxCommands.Command.LOCAL).then(success => {
                resolve();
              }).catch(error => reject(error));
            }).catch(error => reject(error));
          }).catch(error => reject(error));
        }).catch(error => reject(error));
      }).catch(error => reject(error));
    });
  }
}

//------------------------------
// EXPORTS

exports.Grid = Grid;
exports.GridItem = GridItem;