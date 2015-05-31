var fs = require('fs');

var file = function(filename, callback)
{
	fs.open(filename, 'r', function(err, fd)
	{
		if (err)
		{
			callback(err);
			return;
		}

		callback(null, {
			read: function(offset, size, callback)
			{
				var buffer = new Buffer(size);
				fs.read(fd, buffer, 0, size, offset, function(err, numRead)
				{
					if (numRead != size)
					{
						callback('Unable to read ' + size + ' bytes');
						return;
					}

					callback(null, buffer);
				});
			},

			close: function(callback)
			{
				fs.close(fd, callback);
			}
		});
	});
};

file('/Users/wouter/test/Survivor.2015.720p.WEB-DL.DD5.1.H.264-PLAYNOW.part01.rar', function(err, file)
{
	if (err)
	{
		console.log(err);
		return;
	}

	var flags = {
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
	
	var readHeader = function(position, callback)
	{
		file.read(position, 7, function(err, start)
		{
			if (err)
			{
				callback(err);
				return;
			}

			var header = {};

			header.crc = start.readUInt16LE();
			header.type = start.readUInt8(2);
			header.flags = start.readUInt16LE(3);
			header.size = start.readUInt16LE(5);

			// read rest of header
			file.read(position+7, header.size-7, function(err, rest)
			{
				if (err)
				{
					callback(err);
					return;
				}

				var pos = 0;
				switch(header.type)
				{
					case 0x73: // main head
						header.highPosAv = rest.readUInt16LE(pos);pos+=2;
						header.posAv = rest.readUInt16LE(pos);pos+=2;
						header.encryptVer = rest.readUInt8(pos);pos+=1;
						break;
					
					case 0x74: // file head
						header.packSize = rest.readUInt32LE(pos);pos+=4;
						header.unpSize = rest.readUInt32LE(pos);pos+=4;
						header.hostOS = rest.readUInt8(pos);pos+=1;
						header.fileCRC = rest.readUInt32LE(pos);pos+=4;
						header.fileTime = rest.readUInt32LE(pos);pos+=4;
						header.unpVer = rest.readUInt8(pos);pos+=1;
						header.method = rest.readUInt8(pos);pos+=1;
						header.nameSize = rest.readUInt16LE(pos);pos+=2;
						header.fileAttr = rest.readUInt32LE(pos);pos+=4;
						
						if ((header.flags & flags.LHD_LARGE) != 0)
						{
							header.packSize += rest.readUInt32LE(pos) << 32;pos+=4;
							header.unpSize += rest.readUInt32LE(pos) << 32;pos+=4;
						}

						header.filename = rest.slice(pos, pos+=header.nameSize).toString('utf-8');
						
						if ((header.flags & flags.LHD_SALT) != 0)
						{
							header.salt = rest.slice(pos, pos+=8);
						}
						
						break;
				}
				callback(null, {data: header, position: position + header.size});
			});
		});
	};

	var readSignature = function(callback)
	{
		file.read(0, 7, function(err, data)
		{
			if (err)
			{
				callback(err);
				return;
			}

			if (data.toString() != '\x52\x61\x72\x21\x1a\x07\x00')
			{
				callback('Invalid rar file');
			}
			else
			{
				callback(null);
			}
		});
	};

	readSignature(function(err)
	{
		if (err)
		{
			console.log(err);
			return;
		}

		readHeader(7, function (err, data)
		{
			if (err)
			{
				console.log(err);
				return;
			}

			readHeader(data.position, function (err, fileHeader)
			{
				console.log(fileHeader);
				file.close();
			});
		});
	});
});