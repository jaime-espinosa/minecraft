const encoder=new TextEncoder(), decoder=new TextDecoder();
const concat=(...arrays)=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const array of arrays){out.set(array,offset);offset+=array.length;}return out;};
const le16=(value)=>{const bytes=new Uint8Array(2);new DataView(bytes.buffer).setUint16(0,value,true);return bytes;};
const le32=(value)=>{const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,value>>>0,true);return bytes;};
const u16=(bytes,offset)=>new DataView(bytes.buffer,bytes.byteOffset+offset,2).getUint16(0,true);
const u32=(bytes,offset)=>new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0,true);
export const crc32=(bytes)=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};

export function createStoredZip(inputEntries){
  const entries=[...inputEntries].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0); const locals=[],centrals=[];let offset=0;
  for(const entry of entries){const name=encoder.encode(entry.name),bytes=entry.bytes,crc=crc32(bytes);const local=concat(le32(0x04034b50),le16(20),le16(0),le16(0),le16(0),le16(0x21),le32(crc),le32(bytes.length),le32(bytes.length),le16(name.length),le16(0),name,bytes);locals.push(local);
    centrals.push(concat(le32(0x02014b50),le16(20),le16(20),le16(0),le16(0),le16(0),le16(0x21),le32(crc),le32(bytes.length),le32(bytes.length),le16(name.length),le16(0),le16(0),le16(0),le16(0),le32(0),le32(offset),name));offset+=local.length;}
  const central=concat(...centrals);return concat(...locals,central,le32(0x06054b50),le16(0),le16(0),le16(entries.length),le16(entries.length),le32(central.length),le32(offset),le16(0));
}

export function parseStoredZip(bytes){
  const entries=[];let offset=0;
  while(offset+4<=bytes.length&&u32(bytes,offset)===0x04034b50){if(offset+30>bytes.length)throw new TypeError('ZIP local header is truncated');const localOffset=offset,version=u16(bytes,offset+4),flags=u16(bytes,offset+6),method=u16(bytes,offset+8),time=u16(bytes,offset+10),date=u16(bytes,offset+12);if(version!==20||flags!==0||method!==0||time!==0||date!==0x21)throw new TypeError('ZIP entries must use canonical stored metadata');const crc=u32(bytes,offset+14),size=u32(bytes,offset+18),compressed=u32(bytes,offset+22),nameLength=u16(bytes,offset+26),extra=u16(bytes,offset+28);if(size!==compressed||extra!==0)throw new TypeError('ZIP entry metadata mismatch');const nameEnd=offset+30+nameLength,start=nameEnd,dataEnd=start+size;if(nameEnd>bytes.length||dataEnd>bytes.length)throw new TypeError('ZIP local entry is truncated');const name=decoder.decode(bytes.slice(offset+30,nameEnd)),data=bytes.slice(start,dataEnd);if(crc32(data)!==crc)throw new TypeError(`ZIP CRC mismatch for ${name}`);entries.push({name,bytes:data,crc,size,localOffset});offset=dataEnd;}
  const centralStart=offset;for(const entry of entries){if(offset+46>bytes.length||u32(bytes,offset)!==0x02014b50)throw new TypeError('ZIP central directory missing');const nameLength=u16(bytes,offset+28),extra=u16(bytes,offset+30),comment=u16(bytes,offset+32),nameEnd=offset+46+nameLength;if(nameEnd>bytes.length)throw new TypeError('ZIP central entry is truncated');const name=decoder.decode(bytes.slice(offset+46,nameEnd));if(u16(bytes,offset+4)!==20||u16(bytes,offset+6)!==20||u16(bytes,offset+8)!==0||u16(bytes,offset+10)!==0||u16(bytes,offset+12)!==0||u16(bytes,offset+14)!==0x21||u32(bytes,offset+16)!==entry.crc||u32(bytes,offset+20)!==entry.size||u32(bytes,offset+24)!==entry.size||extra!==0||comment!==0||u16(bytes,offset+34)!==0||u16(bytes,offset+36)!==0||u32(bytes,offset+38)!==0||u32(bytes,offset+42)!==entry.localOffset||name!==entry.name)throw new TypeError('ZIP local/central metadata mismatch');offset=nameEnd;}
  if(offset+22>bytes.length||u32(bytes,offset)!==0x06054b50||u16(bytes,offset+4)!==0||u16(bytes,offset+6)!==0||u16(bytes,offset+8)!==entries.length||u16(bytes,offset+10)!==entries.length||u32(bytes,offset+12)!==offset-centralStart||u32(bytes,offset+16)!==centralStart||u16(bytes,offset+20)!==0||offset+22!==bytes.length)throw new TypeError('ZIP end record mismatch');
  return entries.map(({name,bytes})=>({name,bytes}));
}

export const utf8=(value)=>encoder.encode(value);
export const text=(bytes)=>decoder.decode(bytes);
