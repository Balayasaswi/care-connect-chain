// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CIDRegistry {
    struct CidEntry {
        address user;
        string cid;
        uint256 timestamp;
    }

    CidEntry[] private entries;

    event CidStored(address indexed user, string cid, uint256 timestamp);

    function storeCid(string calldata cid) external {
        require(bytes(cid).length > 0, "CID required");
        entries.push(CidEntry({ user: msg.sender, cid: cid, timestamp: block.timestamp }));
        emit CidStored(msg.sender, cid, block.timestamp);
    }

    function getEntryCount() external view returns (uint256) {
        return entries.length;
    }

    function getEntry(uint256 index) external view returns (address, string memory, uint256) {
        CidEntry storage entry = entries[index];
        return (entry.user, entry.cid, entry.timestamp);
    }
}
