import { faker } from "@faker-js/faker";
import User from "../models/user.model";

const createUser = async (numUsers: number) => {
  try {
    const usersPromise = [];

    for (let i = 0; i < numUsers; i++) {
      const tempUser = User.create({
        username: faker.internet.userName(),
        email: faker.internet.email(),
        bio: faker.lorem.sentence(10),
        password: "P@$$w0rd",
        avatar: {
          url: faker.image.avatar(),
          public_id: faker.system.fileName(),
        },
      });
      usersPromise.push(tempUser);
    }

    await Promise.all(usersPromise);

    console.log("Users created", numUsers);
    process.exit(1);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export { createUser };