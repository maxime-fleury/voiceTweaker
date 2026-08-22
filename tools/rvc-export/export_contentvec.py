"""Exporte lengyue233/content-vec-best (format transformers) en ONNX dynamique.

Reproduit le comportement RVC : waveform brute 16 kHz non normalisée en entrée,
hidden state final (= couche 12 du base) en sortie, formes dynamiques.
Usage : python export_contentvec.py <dir_checkpoint> <sortie.onnx>
"""
import sys

import torch
from transformers import HubertModel


class Encoder(torch.nn.Module):
    def __init__(self, hm):
        super().__init__()
        self.hm = hm

    def forward(self, wav):  # wav: [1, T] float32 @16k, brut
        return self.hm(wav).last_hidden_state  # [1, T/320, 768]


def main(src_dir, out_path):
    hm = HubertModel.from_pretrained(src_dir, attn_implementation="eager")
    hm.eval()
    enc = Encoder(hm)
    dummy = torch.zeros(1, 16000)
    with torch.no_grad():
        torch.onnx.export(
            enc,
            dummy,
            out_path,
            input_names=["wav"],
            output_names=["features"],
            dynamic_axes={"wav": [1], "features": [1]},
            opset_version=13,
            do_constant_folding=False,
            dynamo=False,
        )
    print("OK", out_path)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
