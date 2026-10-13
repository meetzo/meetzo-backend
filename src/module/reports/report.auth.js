

export const requireAdmin = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user.role)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};


//is Admin middleware
export const isadmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

