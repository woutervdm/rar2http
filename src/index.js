import {promises as fs} from 'fs';

const File = async filename => {
  const fd = await fs.open(filename, 'r');

  return {
    async read(offset, size) {
      const buffer = new Buffer(size);
      const numRead = await fs.read(fd, buffer, 0, size, offset);
      if (numRead !== size) {
        throw `Unable to read ${size} bytes`;
      }

      return buffer;
    },

    async close() {
      return await fs.close(fd);
    }
  }
};

(async () => {
  const file = await File(process.argv[2]);

  const flags = {
    MHD_VOLUME: 0x0001,
    MHD_COMMENT: 0x0002,
    MHD_LOCK: 0x0004,
    MHD_SOLID: 0x0008,
    MHD_PACK_COMMENT: 0x0010,
    MHD_AV: 0x0020,
    MHD_PROTECT: 0x0040,
    MHD_PASSWORD: 0x0080,
    MHD_FIRSTVOLUME: 0x0100,
    MHD_ENCRYPTVER: 0x0200,

    LHD_SPLIT_BEFORE: 0x0001,
    LHD_SPLIT_AFTER: 0x0002,
    LHD_PASSWORD: 0x0004,
    LHD_COMMENT: 0x0008,
    LHD_SOLID: 0x0010,
    LHD_LARGE: 0x0100,
    LHD_UNICODE: 0x0200,
    LHD_SALT: 0x0400,
    LHD_VERSION: 0x0800,
    LHD_EXTTIME: 0x1000,
    LHD_EXTFLAGS: 0x2000
  };

  const readHeader = async position => {
    const start = await file.read(position, 7);

    const header = {};

    header.crc = start.readUInt16LE();
    header.type = start.readUInt8(2);
    header.flags = start.readUInt16LE(3);
    header.size = start.readUInt16LE(5);

      // read rest of header
    const rest = await file.read(position + 7, header.size - 7);
    let pos = 0;
    switch (header.type) {
      case 0x73: // main head
        header.highPosAv = rest.readUInt16LE(pos);
        pos += 2;
        header.posAv = rest.readUInt16LE(pos);
        pos += 2;
        header.encryptVer = rest.readUInt8(pos);
        pos += 1;
        break;

      case 0x74: // file head
        header.packSize = rest.readUInt32LE(pos);
        pos += 4;
        header.unpSize = rest.readUInt32LE(pos);
        pos += 4;
        header.hostOS = rest.readUInt8(pos);
        pos += 1;
        header.fileCRC = rest.readUInt32LE(pos);
        pos += 4;
        header.fileTime = rest.readUInt32LE(pos);
        pos += 4;
        header.unpVer = rest.readUInt8(pos);
        pos += 1;
        header.method = rest.readUInt8(pos);
        pos += 1;
        header.nameSize = rest.readUInt16LE(pos);
        pos += 2;
        header.fileAttr = rest.readUInt32LE(pos);
        pos += 4;

        if ((header.flags & flags.LHD_LARGE) !== 0) {
          header.packSize += rest.readUInt32LE(pos) << 32;
          pos += 4;
          header.unpSize += rest.readUInt32LE(pos) << 32;
          pos += 4;
        }

        header.filename = rest.slice(pos, pos += header.nameSize).toString('utf-8');

        if ((header.flags & flags.LHD_SALT) !== 0) {
          header.salt = rest.slice(pos, pos += 8);
        }

        break;
    }

    return {data: header, position: position + header.size};
  };

  const readSignature = async () => {
    const data = await file.read(0, 7);

    if (data.toString() !== '\x52\x61\x72\x21\x1a\x07\x00') {
      throw 'Invalid rar file';
    }
  };

  await readSignature();

  const data = await readHeader(7);

  const fileHeader = await readHeader(data.position);
  console.log(fileHeader);
  await file.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
