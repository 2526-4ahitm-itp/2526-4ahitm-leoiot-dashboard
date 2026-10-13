import json
import struct
import sys

def parse_gltf(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    # We won't parse the binary buffers, we just look for translation.
    # But wait, vertices are in the bin file. We really need to read the bin file.
    pass

