import { getDiscoveryProfilesService } from "./discovery.service.js";


export const getDiscoveryProfilesController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const {
      page = 1,
      limit = 20,
    } = req.query;

    const result = await getDiscoveryProfilesService({
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Discovery profiles fetched successfully",
      count: result.data.length,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};