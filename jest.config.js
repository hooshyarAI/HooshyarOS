module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    cache: false,
    roots: ["<rootDir>/Backend"],
    testPathIgnorePatterns: ["/node_modules/", "/dist/productization/"],
};
