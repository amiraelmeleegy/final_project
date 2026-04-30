import mongoose from "mongoose";

const accidentSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    force: { type: Number, required: true },
    videoPath: { type: String }
  },
  { timestamps: true }
);

const Accident = mongoose.model("Accident", accidentSchema);
export default Accident;
