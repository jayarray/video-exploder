
//-------------------------------
// CONSTANTS

let SHAPES = {
  circle: 'c',
  diamond: 'd',
  square: 's'
}

//------------------------------

class Spot {
  constructor(builder) {
    this.width = builder.args.width;
    this.height = builder.args.height;
    this.shape = builder.args.shape;
    this.padding = builder.args.padding;
  }

  static get Builder() {
    class Builder {
      constructor() {
        this.args = {
          width: 5,
          height: 5,
          shape: SHAPES.circle,
          padding: 1
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

      shape(str) {
        this.args.shape = str;
        return this;
      }

      padding(n) {
        this.args.padding = n;
        return this;
      }

      build() {
        return new Spot(this);
      }
    }

    return new Builder();
  }
}

//--------------------------------




//--------------------------------

class ShapeAbstraction {
  constructor(builder) {
    this.source = builder.args.source;
    this.fps = builder.args.fps;
    this.spot = builder.args.spot;
    this.brightness = builder.args.brightness;
    this.contrast = builder.args.contrast;
    this.backgroundColor = builder.args.backgroundColor;
    this.edge = builder.args.edge;
    this.edgeColor = builder.args.edgeColor;
  }

  static get Builder() {
    class Builder {
      constructor() {
        this.args = {
          edge: 0,
          edgeColor: 'gray',
          backgroundColor: 'black',
          brightness: 0,
          contrast: 0
        };
      }

      source(str) {
        this.args.source = str;
        return this;
      }

      fps(n) {
        this.args.fps = n;
        return this;
      }

      spot(o) {
        this.args.spot = o;
        return this;
      }

      brightness(n) {
        this.args.brightness = n;
        return this;
      }

      contrast(n) {
        this.args.contrast = n;
        return this;
      }

      backgroundColor(str) {
        this.args.backgroundColor = str;
        return this;
      }

      egde(n) {
        this.args.edge = n;
        return this;
      }

      edgeColor(str) {
        this.args.edgeColor = str;
        return this;
      }

      build() {
        return new ShapeAbstraction(this);
      }
    }

    return new Builder();
  }

  Render(seqName, outputDir) {
    return new Promise((resolve, reject) => {
      // Turn video into image sequence
    });
  }
}

//-----------------------------------
// EXPORTS

exports.SHAPES = SHAPES;
exports.Spot = Spot;
exports.ShapeAbstraction = ShapeAbstraction;