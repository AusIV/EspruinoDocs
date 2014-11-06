  /* Copyright (C) 2014 Austin Roberts. See the file LICENSE for copying permission. */
  /*
This module interfaces with an LSM303DLHC, a cheap I2C magnetometer / accelerometer.

Usage:
Setup I2C, then call:
var compass = require("LSM303DLHC").connect(i2c,drdy,mode)

i2c is the I2C it is connected to, drdy is the pin that drdy is connected to.

read in single measurement mode:

compass.reads(function(a){print(a);});

read in continuous measurement mode:
compass.setMode(0);
console.log(compass.readc());

You can also get acceleration:

compass.readAcc()

*/



exports.connect = function(i2c,drdy,mode) {
    return new LSM303DLHC(i2c,drdy,range);
};

var COMPASS_REG = 0x1E;
var ACC_REG = 0x32 >> 1;
var INT_REG = 0x30;

function LSM303DLHC(i2c,drdy,mode) {
  this.i2c = i2c;
  this.mode = (mode) ? mode : 1;
  this.drdy = drdy;
  this.a=COMPASS_REG;
  pinMode(drdy,'input');
  this.i2c.writeTo(this.a,1);
  this.gain=(this.i2c.readFrom(this.a,1))>>5;
  this.ngain=this.gain;
  this.i2c.writeTo(this.a,[2,this.mode]);
  this.scale=new Float32Array([0.73,0.92,1.22,1.52,2.27,2.56,3.03,4.35]);
  this.writeAccReg(0x20, 0x27);
}


LSM303DLHC.prototype.readc = function() {
	this.i2c.writeTo(this.a,3);
	var f=this.scale[this.gain];
	this.gain=this.ngain;
	var gdat = this.i2c.readFrom(this.a,6);
	var x = (gdat[0] << 8) | gdat[1];
	var y = (gdat[4] << 8) | gdat[5];
	var z = (gdat[2] << 8) | gdat[3];
	x=(x>=32767) ? x - 65536 : x;
	y=(y>=32767) ? y - 65536 : y;
	z=(z>=32767) ? z - 65536 : z;
	var o=(x==-4096 || y==-4096 || z==-4096);
	return {x:x*f, y:y*f, z:z*f, overflow:o};
};

LSM303DLHC.prototype.setMode = function(mode) {
	this.i2c.writeTo(this.a,[2,(mode & 0x03)]);
    	this.mode=mode&0x03;
};

LSM303DLHC.prototype.setup = function(sample,dout,ms) {
	ms=(ms) ? ms&3 : 0;
	dout=(dout) ? dout&7 : 4;
	sample=sample&3;
	this.i2c.writeTo(this.a,[0,ms|(dout<<2)|(sample<<5)]);
};

LSM303DLHC.prototype.setGain = function(gain) {
	this.i2c.writeTo(this.a,[1,((gain & 7)<<5)]);
	this.i2c.writeTo(this.a,1);
    	this.ngain=(this.i2c.readFrom(this.a,1))>>5;
    	if (this.mode!=2) {
		this.onwatch=c;
		var hmc=this;
		setWatch(function(){hmc.readc();},this.drdy);
		this.setmode(1);
    	}
};

LSM303DLHC.prototype.reads = function(c) {
	this.onwatch=c;
	var hmc=this;
	setWatch(function(){hmc.onwatch(hmc.readc());},this.drdy);
	this.setmode(1);
};

LSM303DLHC.prototype.writeFnReg = function(fn, reg,val) {
  this.i2c.writeTo(fn, [reg,val]);
};

LSM303DLHC.prototype.readFnReg = function(fn, reg,count) {
  // ORing 0x80 auto-increments the register for each read
  this.i2c.writeTo(fn, reg);
  return this.i2c.readFrom(fn, count);
};


LSM303DLHC.prototype.writeAccReg = function(reg,val) {
  this.writeFnReg(ACC_REG, reg, val);
};

LSM303DLHC.prototype.readAccReg = function(reg,count) {
  // ORing 0x80 auto-increments the register for each read
  return this.readFnReg(ACC_REG, reg | 0x80, count);
};
LSM303DLHC.prototype.readAcc = function(reg,count) {
  var d = this.readAccReg(0x28, 6);
  // reconstruct 16 bit data
  var a = [d[0] | (d[1]<<8), d[2] | (d[3]<<8), d[4] | (d[5]<<8)];
  // deal with sign bit
  if (a[0]>=32767) a[0]-=65536;
  if (a[1]>=32767) a[1]-=65536;
  if (a[2]>=32767) a[2]-=65536;
  return {x: a[0], y: a[1], z:a[2]};
};
