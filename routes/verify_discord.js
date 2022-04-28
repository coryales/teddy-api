import express from "express";
import dotenv from 'dotenv';

dotenv.config();

import { openMessage } from "curve25519-js";
import { SecretNetworkClient } from "secretjs";
import { Client, Intents } from "discord.js";

const router = express.Router();

const discordToken = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS]
});
client.login(discordToken);

/* POST validate discord tag. */
router.post("/", async(req, res, next) => {
  try { 
    const roleNameToAdd = "Teddy Owner";

    const guild = client.guilds.cache.get(guildId);
    const roleToAdd = guild.roles.cache.find((r) => r.name === roleNameToAdd);

    let response = { msg: "", msgType:""};

      if (req.body.tokenId) {
        //decrypt discordtag with pub key of teddy id to see if user is the owner
        const metaData = await queryMetadata(req.body.tokenId);
        const pubKey = metaData.nft_dossier.public_metadata.extension.key;
        const uint8key = Uint8Array.from(pubKey);
        const signedMessage = Uint8Array.from(
          req.body.signedMessage.split(",")
        );
        const openedMessage = openMessage(uint8key, signedMessage);
        const discordTag = new TextDecoder().decode(openedMessage);
 
        if (!openMessage || !discordTag) {
          response.msg = "You could not be verified";
          response.msgType = "error";
        } else {
          // Fetch for the user from members instead of members.cache. Cache isn't always correct
          const member = await guild.members
            .fetch()
            .then((members) =>
              members.find((member) => member.user.tag === discordTag)
            );

          // Send message back if user is not part of the discord guild
          if (!member) {
            response.msg = "Please join the MTC discord first";
            response.msgType = "info";
          } else {
            const userRole = member.roles.cache.find(
              (r) => r.id === roleToAdd.id
            );

            // If user tries to verify more than once tell them they are already verified
            if (userRole) {
              response.msg = "You are already verified!";
              response.msgType = "info";
            } else {
              member.roles.add(roleToAdd);
              member.send(
                "Welcome to the MTC! You now have the role of " +
                  roleToAdd.name
              );
              response.msg = "Welcome to the MTC!!! See your new role on the discord";
              response.msgType = "success";
            }
          }
        }
      } else {
        response.msg = "Invalid Request";
        response.msgType = "error";
      } 
    res.end(JSON.stringify(response));
  } catch (err) {  
    let response = { msg: "Unexpected Error!!", msgType: "error"};
    console.error(`Error while validating discord`, err.message); 
    res.end(JSON.stringify(response));
  }
});

const queryMetadata = async (tokenId) => { 
    const client = await SecretNetworkClient.create({
        grpcWebUrl: process.env.GRPC_URL,
        chainId: process.env.CHAIN_ID,
      });  
       
    const msg = {
        nft_dossier: {
            token_id: tokenId
        }
    };

    const data = await client.query.compute.queryContract({
        contractAddress: process.env.NFT_CONTRACT_ADDRESS,
        //codeHash: process.env., // optional but way faster
        query: msg,
    });
    return data;
};

export default router;